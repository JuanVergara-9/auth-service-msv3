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
    const { accessToken, refreshToken } = await issueTokensForUser(user);

    const response = { user: serializeUser(user), accessToken, refreshToken };

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

  const { accessToken, refreshToken } = await issueTokensForUser(user);
  return { user: serializeUser(user), accessToken, refreshToken };
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
  const { accessToken, refreshToken: newRefresh } = await issueTokensForUser(user);
  return { user: serializeUser(user), accessToken, refreshToken: newRefresh };
}

async function logout({ refreshToken }) {
  if (!refreshToken) return { ok: true };
  try {
    const payload = verifyRefreshToken(refreshToken);
    await RefreshToken.update({ revoked: true }, { where: { jti: payload.jti } });
  } catch { /* noop */ }
  return { ok: true };
}

async function issueTokensForUser(user) {
  const jti = uuidv4();
  const accessToken = signAccessToken(user);
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

function serializeUser(user) {
  return { id: user.id, email: user.email, role: user.role, isEmailVerified: user.is_email_verified };
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

  return { success: true, user: serializeUser(verificationToken.user) };
}

module.exports = { 
  register, 
  login, 
  refresh, 
  logout, 
  sendVerificationEmailForUser, 
  verifyEmailToken 
};
