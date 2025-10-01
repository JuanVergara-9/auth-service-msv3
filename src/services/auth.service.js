const crypto = require('crypto');
const { User, RefreshToken } = require('../../models');
const { hashPassword, verifyPassword } = require('../utils/crypto');
const { signAccessToken, signRefreshToken, verifyRefreshToken, expiresAtFromNow, uuidv4 } = require('../utils/jwt');
const { badRequest, conflict, unauthorized } = require('../utils/httpError');
const dayjs = require('dayjs');

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

    console.log(`[register] Hashing password...`);
    const password_hash = await hashPassword(password);
    
    console.log(`[register] Creating user...`);
    const user = await User.create({ email, password_hash, role: 'user' });
    console.log(`[register] User created with ID: ${user.id}`);

    console.log(`[register] Issuing tokens...`);
    const { accessToken, refreshToken } = await issueTokensForUser(user);
    
    console.log(`[register] Registration successful for user: ${user.id}`);
    return { user: serializeUser(user), accessToken, refreshToken };
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

module.exports = { register, login, refresh, logout };
