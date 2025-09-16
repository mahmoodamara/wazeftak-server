// محققات بسيطة قابلة للاستخدام في الكنترولرز/الخدمات

const mongoose = require('mongoose');

function isValidObjectId(id) {
  return mongoose.isValidObjectId(id);
}

function isEmail(val = '') {
  return /\S+@\S+\.\S+/.test(String(val));
}

function isHttpUrl(val = '') {
  return /^https?:\/\//i.test(String(val));
}

function isWhatsapp(val = '') {
  return /^(\+?\d[\d\s-]{6,}|https?:\/\/wa\.me\/\d+)/i.test(String(val));
}

module.exports = { isValidObjectId, isEmail, isHttpUrl, isWhatsapp };
