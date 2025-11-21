const { z } = require('zod');
const svc = require('../services/auth.service');

const registerSchema = z.object({
  email: z.string().email().max(160),
  password: z.string().min(8).max(72)
});
const loginSchema = registerSchema;

async function register(req, res, next) {
  try {
    const data = registerSchema.parse(req.body);
    const result = await svc.register(data);
    return res.status(201).json(result);
  } catch (e) { next(e); }
}

async function login(req, res, next) {
  try {
    const data = loginSchema.parse(req.body);
    const result = await svc.login(data);
    return res.json(result);
  } catch (e) { next(e); }
}

async function me(req, res, next) {
  try {
    // viene de middleware requireAuth
    return res.json({ userId: req.user.userId, role: req.user.role });
  } catch (e) { next(e); }
}

async function refresh(req, res, next) {
  try {
    const result = await svc.refresh({ refreshToken: req.body.refreshToken });
    return res.json(result);
  } catch (e) { next(e); }
}

async function logout(req, res, next) {
  try {
    await svc.logout({ refreshToken: req.body.refreshToken });
    return res.json({ ok: true });
  } catch (e) { next(e); }
}

async function sendVerificationEmail(req, res, next) {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new Error('Usuario no autenticado');
    const user = await require('../../models').User.findByPk(userId);
    if (!user) throw new Error('Usuario no encontrado');
    const result = await svc.sendVerificationEmailForUser(userId, user.email);
    return res.json(result);
  } catch (e) { next(e); }
}

async function verifyEmail(req, res, next) {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: { code: 'AUTH.MISSING_TOKEN', message: 'Token requerido' } });
    }
    const result = await svc.verifyEmailToken(token);
    return res.json(result);
  } catch (e) { next(e); }
}

async function usersSummary(req, res, next) {
  try {
    const result = await svc.getUsersSummary();
    return res.json(result);
  } catch (e) { next(e); }
}

module.exports = { register, login, me, refresh, logout, sendVerificationEmail, verifyEmail, usersSummary };
