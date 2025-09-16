// src/config/db.js
// تهيئة اتصال Mongoose مع إعادة المحاولة وتسجيل أحداث الاتصال

const mongoose = require('mongoose');
const {
  MONGO_URI,
  MONGO_DBNAME,
  MONGO_DEBUG,
  MONGO_AUTO_INDEX,
  MONGO_MIN_POOL,
  MONGO_MAX_POOL,
  MONGO_SOCKET_TIMEOUT_MS,
  MONGO_SERVER_SELECTION_TIMEOUT_MS,
  NODE_ENV
} = require('./env');

// إعدادات عامة
mongoose.set('strictQuery', true);
mongoose.set('debug', !!MONGO_DEBUG);

/**
 * اتصال بقاعدة البيانات مع إعادة محاولة تلقائية
 */
async function connectDB(retries = 5, retryDelayMs = 3000) {
  const opts = {
    dbName: MONGO_DBNAME || undefined,
    autoIndex: !!MONGO_AUTO_INDEX,
    minPoolSize: MONGO_MIN_POOL || 1,
    maxPoolSize: MONGO_MAX_POOL || 10,
    socketTimeoutMS: MONGO_SOCKET_TIMEOUT_MS || 45000,
    serverSelectionTimeoutMS: MONGO_SERVER_SELECTION_TIMEOUT_MS || 15000
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(MONGO_URI, opts);
      console.log(`✅ Mongo connected (${NODE_ENV})`);
      break;
    } catch (err) {
      console.error(`❌ Mongo connect failed [attempt ${attempt}/${retries}]:`, err.message);
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, retryDelayMs));
    }
  }

  // أحداث الاتصال — مفيدة للتشخيص
  mongoose.connection.on('connected', () => {
    console.log('📡 Mongoose connected');
  });

  mongoose.connection.on('error', (err) => {
    console.error('🛑 Mongoose connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  Mongoose disconnected');
  });

  // إغلاق لطيف عند إنهاء العملية
  process.on('SIGINT', gracefulExit);
  process.on('SIGTERM', gracefulExit);
}

async function gracefulExit() {
  try {
    await mongoose.connection.close();
    console.log('✅ Mongoose connection closed');
    // لا تستدعي process.exit هنا — يُدار في server.js
  } catch (e) {
    console.error('Error closing mongoose:', e);
  }
}

module.exports = connectDB;
