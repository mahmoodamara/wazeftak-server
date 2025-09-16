// src/config/env.js
// تحميل المتغيرات من .env وتوفير دوال مساعدة للوصول إليها

const dotenv = require('dotenv');

// حمّل .env إن وُجد
dotenv.config();

// Helpers
function get(key, fallback = undefined) {
  const val = process.env[key];
  return (val === undefined || val === '') ? fallback : val;
}

function getInt(key, fallback = undefined) {
  const n = parseInt(get(key), 10);
  return Number.isFinite(n) ? n : fallback;
}

function getBool(key, fallback = undefined) {
  const v = get(key);
  if (v === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

function getList(key, fallback = []) {
  const v = get(key);
  if (!v) return fallback;
  return String(v)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

// الأساسيات
const NODE_ENV = get('NODE_ENV', 'development');
const PORT = getInt('PORT', 5000);

// Mongo
const MONGO_URI = get('MONGO_URI', 'mongodb://127.0.0.1:27017/localjobs');
const MONGO_DBNAME = get('MONGO_DBNAME'); // اختياري، إن لم يتم تضمينه ضمن الـ URI

// JWT
const JWT_SECRET = get('JWT_SECRET', 'change-me-in-prod');
const JWT_EXPIRES = get('JWT_EXPIRES', '7d');

// رفع الملفات الثابتة
const UPLOAD_DIR = get('UPLOAD_DIR', 'uploads'); // مسار نسبي داخل المشروع

// CORS
const ALLOWED_ORIGIN = getList('ALLOWED_ORIGIN', []); // مثال: http://localhost:5173,https://yourdomain.com

// Debug/خيارات متقدمة
const MONGO_DEBUG = getBool('MONGO_DEBUG', NODE_ENV !== 'production');
const MONGO_AUTO_INDEX = getBool('MONGO_AUTO_INDEX', NODE_ENV !== 'production');
const MONGO_MIN_POOL = getInt('MONGO_MIN_POOL', 1);
const MONGO_MAX_POOL = getInt('MONGO_MAX_POOL', 10);
const MONGO_SOCKET_TIMEOUT_MS = getInt('MONGO_SOCKET_TIMEOUT_MS', 45000);
const MONGO_SERVER_SELECTION_TIMEOUT_MS = getInt('MONGO_SERVER_SELECTION_TIMEOUT_MS', 15000);

module.exports = {
  // عام
  NODE_ENV,
  PORT,

  // Mongo
  MONGO_URI,
  MONGO_DBNAME,
  MONGO_DEBUG,
  MONGO_AUTO_INDEX,
  MONGO_MIN_POOL,
  MONGO_MAX_POOL,
  MONGO_SOCKET_TIMEOUT_MS,
  MONGO_SERVER_SELECTION_TIMEOUT_MS,

  // JWT
  JWT_SECRET,
  JWT_EXPIRES,

  // Static uploads
  UPLOAD_DIR,

  // CORS
  ALLOWED_ORIGIN,

  // Helpers للتصدير إن احتجتها لاحقًا
  get,
  getInt,
  getBool,
  getList
};
