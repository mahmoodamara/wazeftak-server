// توليد JWT و Refresh Tokens (hash فقط) + أدوات عامة للتوكينات

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES } = require('../config/env');

/** يوقع Access Token بسيط */
function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES || '7d' });
}

/** يولّد توكن عشوائي (raw) + hash sha256 للتخزين */
function generateRawToken(bytes = 48) {
  const raw = crypto.randomBytes(bytes).toString('hex'); // 96 chars
  const hash = sha256(raw);
  return { raw, hash };
}

/** دالة تجزئة sha256 هيكس */
function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

/** مقارنة ثابتة الزمن */
function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  signAccessToken,
  generateRawToken,
  sha256,
  timingSafeEqual
};
