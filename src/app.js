// src/app.js
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const crypto = require('crypto');

const cron = require("node-cron");
const Ad = require("./models/Ad");

const rateLimit = require("express-rate-limit");
const analyticsRoutes = require("./routes/analytics");


const { notFound, errorHandler } = require('./middleware/error');
const { ALLOWED_ORIGIN, NODE_ENV, UPLOAD_DIR } = require('./config/env');

// ✅ أنشئ التطبيق
const app = express();
const cookieParser = require('cookie-parser');
app.use(cookieParser());
// ====== أمان وأساسيات ======
app.set('x-powered-by', false);
app.disable('etag'); // اختياري: لتفادي caching غير مرغوب
app.set('trust proxy', 1);

// Request ID بسيط للتتبع (يفيد في AuditLog)
app.use((req, _res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  next();
});

// Helmet
app.use(helmet());

// CORS
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // للسماح للأدوات المحلّية (Postman, curl)
    const allow = Array.isArray(ALLOWED_ORIGIN)
      ? ALLOWED_ORIGIN
      : String(ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
    if (allow.length === 0 || allow.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With','X-Request-Id']
};
app.use(cors(corsOptions));

// Logs
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ====== Static Files (/static) ======
const uploadsDir = path.join(process.cwd(), UPLOAD_DIR || 'uploads');
// ملاحظة: تأكد إنشاء مجلد الرفع عند الإقلاع (في server.js) أو هنا إن رغبت
app.use('/static', express.static(uploadsDir, {
  fallthrough: true,
  index: false,
  maxAge: NODE_ENV === 'production' ? '7d' : 0,
  setHeaders: (res) => {
    // أمان أساسي للملفات الثابتة
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

// ====== Healthcheck ======
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: NODE_ENV || 'development' });
});
const jobRequestsRoutes = require("./routes/jobRequests");
const adsRoutes = require("./routes/ads");

// ====== Routes ======
app.use('/api/auth',          require('./routes/authRoutes'));
app.use('/api/users',         require('./routes/userRoutes'));
app.use('/api/companies',     require('./routes/companyRoutes'));
app.use('/api/jobs',          require('./routes/jobRoutes'));
app.use('/api/applications',  require('./routes/applicationRoutes'));
app.use('/api/saved',         require('./routes/savedRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/reports',       require('./routes/reportRoutes'));
app.use('/api/taxonomies',    require('./routes/taxonomyRoutes'));
app.use('/api/files',         require('./routes/fileRoutes'));
app.use("/api/job-requests", jobRequestsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/ads", adsRoutes);
const leadsRouter = require("./routes/leads.router");
app.use("/api/leads", leadsRouter);



// (اختياري) لو فعّلت هذه الراوترات الإضافية:
try { app.use('/api/admin/audit-logs', require('./routes/adminAuditRoutes')); } catch {}
try { app.use('/api/auth/sessions',     require('./routes/sessionRoutes')); } catch {}
try { app.use('/api/verify',            require('./routes/verificationRoutes')); } catch {}

// ====== أخطاء عامة ======
app.use(notFound);
app.use(errorHandler);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 100,                 // 100 طلب
  message: "تم تجاوز الحد المسموح من الطلبات. حاول لاحقًا.",
  standardHeaders: true,    // يرسل هيدرز معلومات
  legacyHeaders: false,     // يعطل X-RateLimit
});



app.use(globalLimiter);


cron.schedule("0 0 * * *", async () => {
  await Ad.updateMany(
    { expiresAt: { $lt: new Date() } },
    { status: "expired" }
  );
  console.log("🔄 تم تعطيل الإعلانات المنتهية");
});

module.exports = app;
