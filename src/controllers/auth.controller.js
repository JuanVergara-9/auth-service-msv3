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

module.exports = { register, login, me, refresh, logout };
