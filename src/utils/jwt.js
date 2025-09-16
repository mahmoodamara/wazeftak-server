// src/utils/jwt.js
const jwt = require('jsonwebtoken');

const ACCESS_TTL  = process.env.JWT_ACCESS_TTL  || '15m';
const REFRESH_TTL = process.env.JWT_REFRESH_TTL || '30d';
const JWT_SECRET  = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET غير معرّف في البيئة');
}

function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TTL });
}

function verifyAccessToken(token) {
  // سيرمي خطأ لو غير صالح/منتهي — نحن نتعامل معه في الميدلوير
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
};
