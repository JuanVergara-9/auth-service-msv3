const jwt = require('jsonwebtoken');
const dayjs = require('dayjs');
const { v4: uuidv4 } = require('uuid');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TTL = process.env.REFRESH_TOKEN_TTL || '30d';

function signAccessToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

function signRefreshToken(user, jti) {
  return jwt.sign(
    { userId: user.id, jti },
    REFRESH_SECRET,
    { expiresIn: REFRESH_TTL }
  );
}

function verifyAccessToken(token) { return jwt.verify(token, ACCESS_SECRET); }
function verifyRefreshToken(token) { return jwt.verify(token, REFRESH_SECRET); }
function expiresAtFromNow(ttl) { return dayjs().add(parseTtl(ttl).value, parseTtl(ttl).unit).toDate(); }

// simple parser '15m' -> {value:15, unit:'minute'}
function parseTtl(ttl) {
  const m = /^(\d+)\s*([smhd])$/.exec(ttl);
  if (!m) return { value: 15, unit: 'minute' };
  return {
    value: Number(m[1]),
    unit: m[2] === 's' ? 'second' : m[2] === 'm' ? 'minute' : m[2] === 'h' ? 'hour' : 'day'
  };
}

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, expiresAtFromNow, uuidv4 };
