const crypto = require('crypto');
const { User, RefreshToken, EmailVerificationToken } = require('../../models');
const { hashPassword, verifyPassword } = require('../utils/crypto');
const { signAccessToken, signRefreshToken, verifyRefreshToken, expiresAtFromNow, uuidv4 } = require('../utils/jwt');
const { badRequest, conflict, unauthorized, notFound } = require('../utils/httpError');
const dayjs = require('dayjs');
const { sendVerificationEmail, verifyEmailDomain } = require('./email.service');

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

async function register({ email, password }) {
  console.log(`[register] Starting registration for email: ${email}`);
  
  try {
    console.log(`[register] Checking if user exists...`);
    const exists = await User.findOne({ where: { email } });
    if (exists) {
      console.log(`[register] User already exists`);
      throw conflict('AUTH.EMAIL_TAKEN', 'El email ya está registrado');
    }

    // Verificar que el dominio del email existe (opcional, no bloquea si falla)
    if (process.env.VERIFY_EMAIL_DOMAIN === 'true') {
      console.log(`[register] Verifying email domain...`);
      const domainValid = await verifyEmailDomain(email);
      if (!domainValid) {
        console.log(`[register] Email domain validation failed for: ${email}`);
        throw badRequest('AUTH.INVALID_EMAIL_DOMAIN', 'El dominio del correo electrónico no es válido');
      }
    }

    console.log(`[register] Hashing password...`);
    const password_hash = await hashPassword(password);
    
    console.log(`[register] Creating user...`);
    const user = await User.create({ email, password_hash, role: 'user' });
    console.log(`[register] User created with ID: ${user.id}`);

    console.log(`[register] Issuing tokens...`);
    const isProvider = false; // Usuario nuevo nunca es proveedor todavía
    const { accessToken, refreshToken } = await issueTokensForUser(user, isProvider);

    const response = { user: serializeUser(user, isProvider), accessToken, refreshToken };

    // Enviar email de verificación de forma asíncrona (no bloquear registro)
    setImmediate(() => {
      sendVerificationEmailForUser(user.id, email)
        .then(() => {
          console.log(`[register] Verification email sent successfully for user: ${user.id}`);
        })
        .catch((emailError) => {
          console.error(
            `[register] Failed to send verification email for user ${user.id}:`,
            emailError.message
          );
        });
    });
    
    console.log(`[register] Registration successful for user: ${user.id}`);
    return response;
  } catch (error) {
    console.error(`[register] Error during registration:`, error.message);
    throw error;
  }
}

async function login({ email, password }) {
  const user = await User.findOne({ where: { email } });
  if (!user) throw unauthorized('AUTH.INVALID_CREDENTIALS', 'Credenciales inválidas');

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) throw unauthorized('AUTH.INVALID_CREDENTIALS', 'Credenciales inválidas');

  const isProvider = await checkProviderStatus(user.id);
  const { accessToken, refreshToken } = await issueTokensForUser(user, isProvider);
  return { user: serializeUser(user, isProvider), accessToken, refreshToken };
}

async function refresh({ refreshToken }) {
  if (!refreshToken) throw badRequest('AUTH.MISSING_REFRESH', 'Refresh token requerido');
  let payload;
  try { payload = verifyRefreshToken(refreshToken); }
  catch { throw unauthorized('AUTH.INVALID_REFRESH', 'Refresh inválido'); }

  const tokenHash = sha256(refreshToken);
  const stored = await RefreshToken.findOne({ where: { jti: payload.jti, token_hash: tokenHash, revoked: false } });
  if (!stored || dayjs(stored.expires_at).isBefore(dayjs())) {
    throw unauthorized('AUTH.REFRESH_REVOKED', 'Refresh inválido o revocado');
  }

  // rotate
  await stored.update({ revoked: true });
  const user = await User.findByPk(stored.user_id);
  const isProvider = await checkProviderStatus(user.id);
  const { accessToken, refreshToken: newRefresh } = await issueTokensForUser(user, isProvider);
  return { user: serializeUser(user, isProvider), accessToken, refreshToken: newRefresh };
}

async function logout({ refreshToken }) {
  if (!refreshToken) return { ok: true };
  try {
    const payload = verifyRefreshToken(refreshToken);
    await RefreshToken.update({ revoked: true }, { where: { jti: payload.jti } });
  } catch { /* noop */ }
  return { ok: true };
}

async function issueTokensForUser(user, isProvider = false) {
  const jti = uuidv4();
  const accessToken = signAccessToken(user, isProvider);
  const refreshToken = signRefreshToken(user, jti);
  await RefreshToken.create({
    user_id: user.id,
    jti,
    token_hash: sha256(refreshToken),
    revoked: false,
    expires_at: expiresAtFromNow(process.env.REFRESH_TOKEN_TTL || '30d')
  });
  return { accessToken, refreshToken };
}

function serializeUser(user, isProvider = false) {
  return { 
    id: user.id, 
    email: user.email, 
    role: user.role, 
    isEmailVerified: user.is_email_verified,
    isProvider 
  };
}

/**
 * Verifica si un usuario es proveedor consultando al provider-service
 */
async function checkProviderStatus(userId) {
  try {
    const providerServiceUrl = process.env.PROVIDER_SERVICE_URL || 'https://provider-service-msv3-production.up.railway.app';
    const checkUrl = `${providerServiceUrl.replace(/\/+$/, '')}/api/v1/providers/check/${userId}`;
    console.log(`[checkProviderStatus] Verificando usuario ${userId} en: ${checkUrl}`);
    
    const response = await fetch(checkUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      const data = await response.json();
      return !!data.isProvider;
    }
    console.warn(`[checkProviderStatus] Respuesta no exitosa (${response.status}) para usuario ${userId}`);
  } catch (error) {
    console.warn(`[checkProviderStatus] Error al verificar estado de proveedor para usuario ${userId}:`, error.message);
  }
  return false;
}

// Generar y enviar token de verificación de email
async function sendVerificationEmailForUser(userId, email) {
  const user = await User.findByPk(userId);
  if (!user) throw notFound('AUTH.USER_NOT_FOUND', 'Usuario no encontrado');
  if (user.is_email_verified) {
    throw badRequest('AUTH.ALREADY_VERIFIED', 'El email ya está verificado');
  }

  // Invalidar tokens anteriores no usados
  await EmailVerificationToken.update(
    { used: true },
    { where: { user_id: userId, used: false } }
  );

  // Generar nuevo token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = dayjs().add(24, 'hours').toDate();

  await EmailVerificationToken.create({
    user_id: userId,
    token,
    expires_at: expiresAt,
    used: false
  });

  // Enviar email
  await sendVerificationEmail(email, token, user.email.split('@')[0]);
  return { success: true };
}

// Verificar token de email
async function verifyEmailToken(token) {
  const verificationToken = await EmailVerificationToken.findOne({
    where: { token, used: false },
    include: [{ model: User, as: 'user' }]
  });

  if (!verificationToken) {
    throw badRequest('AUTH.INVALID_TOKEN', 'Token de verificación inválido o ya usado');
  }

  if (dayjs(verificationToken.expires_at).isBefore(dayjs())) {
    throw badRequest('AUTH.TOKEN_EXPIRED', 'El token de verificación ha expirado');
  }

  // Marcar token como usado y verificar email del usuario
  await verificationToken.update({ used: true });
  await verificationToken.user.update({ is_email_verified: true });

  const isProvider = await checkProviderStatus(verificationToken.user.id);
  return { success: true, user: serializeUser(verificationToken.user, isProvider) };
}

// Obtener resumen de usuarios (para admin dashboard)
async function getUsersSummary() {
  const totalUsers = await User.count();
  const adminsRegistered = await User.count({ where: { role: 'admin' } });

  // Obtener lista de user_ids que son proveedores desde provider-service
  let providerUserIds = [];
  try {
    // Intentar obtener desde el gateway o directamente del provider-service
    const gatewayUrl = process.env.GATEWAY_URL || process.env.API_GATEWAY_URL || 'http://localhost:4000';
    const providerServiceUrl = process.env.PROVIDER_SERVICE_URL || 'http://localhost:3002';
    
    // Intentar primero por gateway, luego directo
    let response;
    try {
      response = await fetch(`${gatewayUrl}/api/v1/providers/user-ids`, {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch {
      response = await fetch(`${providerServiceUrl}/api/v1/providers/user-ids`, {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (response && response.ok) {
      const data = await response.json();
      providerUserIds = Array.isArray(data.userIds) ? data.userIds : [];
    }
  } catch (error) {
    console.warn('[getUsersSummary] No se pudo obtener lista de proveedores:', error.message);
    // Continuar sin la lista de proveedores (fallback)
  }

  // Calcular solo clientes: usuarios que NO son proveedores (excluyendo admins)
  const { Op } = require('sequelize');
  const soloClientes = providerUserIds.length > 0
    ? await User.count({
        where: {
          role: 'user',
          id: { [Op.notIn]: providerUserIds }
        }
      })
    : await User.count({ where: { role: 'user' } }); // Fallback si no hay proveedores

  // Proveedores: cantidad de user_ids únicos que tienen perfil de proveedor
  const workersRegistered = providerUserIds.length;

  // Usuarios activos en los últimos 30 días (basado en refresh tokens)
  // Solo contar usuarios que realmente existen en la tabla users
  const thirtyDaysAgo = dayjs().subtract(30, 'days').toDate();
  
  const { sequelize } = require('../../models');
  const [activeUsersResult] = await sequelize.query(`
    SELECT COUNT(DISTINCT rt.user_id) as count
    FROM refresh_tokens rt
    INNER JOIN users u ON rt.user_id = u.id
    WHERE rt.created_at >= :thirtyDaysAgo
      AND rt.user_id IS NOT NULL
  `, {
    replacements: { thirtyDaysAgo },
    type: sequelize.QueryTypes.SELECT
  });
  
  const activeUsers30d = Number(activeUsersResult?.count || 0);

  // Calcular clientes activos: usuarios activos que NO son proveedores (y existen)
  let activeClients30d = 0;
  if (providerUserIds.length > 0) {
    const placeholders = providerUserIds.map((_, i) => `$${i + 2}`).join(',');
    const [activeClientsResult] = await sequelize.query(`
      SELECT COUNT(DISTINCT rt.user_id) as count
      FROM refresh_tokens rt
      INNER JOIN users u ON rt.user_id = u.id
      WHERE rt.created_at >= $1
        AND rt.user_id IS NOT NULL
        AND rt.user_id NOT IN (${placeholders})
    `, {
      bind: [thirtyDaysAgo, ...providerUserIds],
      type: sequelize.QueryTypes.SELECT
    });
    activeClients30d = Number(activeClientsResult?.count || 0);
  } else {
    // Si no hay proveedores, todos los activos son clientes
    activeClients30d = activeUsers30d;
  }

  // Calcular proveedores activos: usuarios activos que SÍ son proveedores (y existen)
  let activeWorkers30d = 0;
  if (providerUserIds.length > 0) {
    const placeholders = providerUserIds.map((_, i) => `$${i + 2}`).join(',');
    const [activeWorkersResult] = await sequelize.query(`
      SELECT COUNT(DISTINCT rt.user_id) as count
      FROM refresh_tokens rt
      INNER JOIN users u ON rt.user_id = u.id
      WHERE rt.created_at >= $1
        AND rt.user_id IS NOT NULL
        AND rt.user_id IN (${placeholders})
    `, {
      bind: [thirtyDaysAgo, ...providerUserIds],
      type: sequelize.QueryTypes.SELECT
    });
    activeWorkers30d = Number(activeWorkersResult?.count || 0);
  } else {
    activeWorkers30d = 0;
  }

  return {
    totalUsers,
    clientsRegistered: soloClientes, // Solo clientes (sin proveedores)
    workersRegistered, // Cantidad de proveedores
    adminsRegistered,
    activeUsers30d,
    activeClients30d,
    activeWorkers30d
  };
}

module.exports = { 
  register, 
  login, 
  refresh, 
  logout, 
  sendVerificationEmailForUser, 
  verifyEmailToken,
  getUsersSummary
};
