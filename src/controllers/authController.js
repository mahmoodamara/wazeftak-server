const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { signAccessToken, generateRawToken, sha256, timingSafeEqual } = require('../utils/tokens');
const { ok, created, error } = require('../utils/responses');
const { sendEmail } = require('../utils/mailer');

const User = require('../models/User');
const Company = require('../models/Company');
const RefreshToken = require('../models/RefreshToken');
const VerificationToken = require('../models/VerificationToken');
const { logAudit } = require('../utils/audit');

// ===== إعدادات OTP البريد =====
const REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 يوم
const EMAIL_OTP_TTL_MS = 1000 * 60 * 10;         // 10 دقائق
const EMAIL_OTP_LENGTH = 6;
const EMAIL_OTP_RESEND_THROTTLE_MS = 1000 * 30;  // 30 ثانية
const EMAIL_OTP_MAX_ATTEMPTS = 5;

function generateOtp(n = EMAIL_OTP_LENGTH) {
  const max = Math.pow(10, n);
  const num = crypto.randomInt(0, max);
  return String(num).padStart(n, '0'); // 000123
}

function maskEmail(email) {
  const [u,d] = String(email).split('@');
  if (!u || !d) return email;
  if (u.length <= 2) return `${u[0]}***@${d}`;
  return `${u[0]}***${u[u.length - 1]}@${d}`;
}

// يصدر/يعيد إرسال OTP مع ثروتل ومحاولات
// ===== Helpers =====
async function issueEmailOtp({ user, req }) {
  let rec = await VerificationToken.findOne({
    userId: user._id,
    type: 'email',
    usedAt: { $exists: false }
  }).sort({ createdAt: -1 });

  const now = Date.now();
  if (rec && rec.lastSentAt && (now - rec.lastSentAt.getTime()) < EMAIL_OTP_RESEND_THROTTLE_MS) {
    const retryAfterMs = EMAIL_OTP_RESEND_THROTTLE_MS - (now - rec.lastSentAt.getTime());
    return { throttled: true, retryAfterMs };
  }

  const otp = generateOtp();
  const tokenHash = sha256(otp);

  if (rec) {
    rec.tokenHash = tokenHash;
    rec.expiresAt = new Date(now + EMAIL_OTP_TTL_MS);
    rec.lastSentAt = new Date();
    rec.attemptsLeft = EMAIL_OTP_MAX_ATTEMPTS;
    rec.destination = user.email;
    await rec.save();
  } else {
    rec = await VerificationToken.create({
      userId: user._id,
      type: 'email',
      tokenHash,
      expiresAt: new Date(now + EMAIL_OTP_TTL_MS),
      attemptsLeft: EMAIL_OTP_MAX_ATTEMPTS,
      lastSentAt: new Date(),
      destination: user.email
    });
  }

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6">
      <h2 style="margin:0 0 8px">رمز التحقق من البريد</h2>
      <p>مرحبًا ${user.name || ''}،</p>
      <p>رمز التحقق الخاص بك هو:</p>
      <div style="font-size:24px;font-weight:bold;letter-spacing:4px">${otp}</div>
      <p>ينتهي خلال <b>10 دقائق</b>.</p>
      <p style="color:#64748b;font-size:12px">طلب من: ${req.ip} — ${req.headers['user-agent'] || ''}</p>
    </div>
  `;

  try {
    const mail = await sendEmail({
      to: user.email,
      subject: 'رمز التحقق من البريد (OTP)',
      html,
      text: `رمز التحقق: ${otp} (ينتهي خلال 10 دقائق)`
    });

    // أرجع رابط المعاينة (Ethereal) فقط لو بيئة تطوير
    const devPreviewUrl = process.env.NODE_ENV !== 'production' ? mail.previewUrl : undefined;

    return { throttled: false, recordId: rec._id, devPreviewUrl };
  } catch (err) {
    console.error('❌ فشل إرسال البريد:', err.code || err.message);

    if (process.env.NODE_ENV !== 'production') {
      // في التطوير: نكمل التدفق ونطبع OTP في اللوج
      console.info('📧 OTP (DEV MODE):', otp);
      return { throttled: false, recordId: rec._id, devNote: 'Email not sent (DEV)', otp };
    }

    // في الإنتاج: نوقف العملية ونرمي خطأ
    throw new Error('MAIL_SEND_FAILED');
  }
}


/* =============== register: إنشاء المستخدم + إرسال OTP =============== */
exports.register = async (req, res) => {
  const { role, name, email, password, phone, city, locale } = req.body;

  const exists = await User.findOne({ email });
  if (exists) return error(res, 409, 'البريد مستخدم');

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ role, name, email, phone, city, locale, passwordHash, emailVerified: false });

  if (role === 'company') {
    const company = await Company.create({ ownerId: user._id, name, city: city || '' });
    await Company.ensureSlug(company);
    await company.save();
    user.companyId = company._id;
    await user.save();
  }

  let otpRes;
  try {
    otpRes = await issueEmailOtp({ user, req });
  } catch (e) {
    if (e.message === 'MAIL_SEND_FAILED') {
      return error(res, 503, 'تعذر إرسال البريد الآن. حاول لاحقًا.');
    }
    throw e; // غير متوقع
  }

  const accessToken = signAccessToken({ id: user._id, role: user.role });
  const { raw, hash } = generateRawToken();
  await RefreshToken.create({
    userId: user._id,
    tokenHash: hash,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS)
  });

  await logAudit(req, { action: 'register', target: { model: 'User', id: user._id } });

  return created(res, {
    accessToken,
    refreshToken: raw,
    user: user.toJSON(),
    emailVerification: {
      sent: !otpRes.throttled,
      maskedEmail: maskEmail(user.email),
      expiresInSec: Math.floor(EMAIL_OTP_TTL_MS / 1000),
      resendAfterSec: otpRes.throttled ? Math.ceil(otpRes.retryAfterMs / 1000) : 0,
      ...(otpRes.devPreviewUrl ? { devPreviewUrl: otpRes.devPreviewUrl } : {}),
      ...(otpRes.devNote ? { devNote: otpRes.devNote } : {})
    }
  });
};

/* =============== login: كما هو (مع إرجاع حالة التحقق) =============== */
exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) return error(res, 401, 'بيانات غير صحيحة');
  if (user.disabled) return error(res, 403, 'الحساب معطّل');

  const okPass = await bcrypt.compare(password, user.passwordHash);
  if (!okPass) return error(res, 401, 'بيانات غير صحيحة');

  const accessToken = signAccessToken({ id: user._id, role: user.role });
  const { raw, hash } = generateRawToken();
  await RefreshToken.create({
    userId: user._id,
    tokenHash: hash,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS)
  });

  await logAudit(req, { action: 'login', target: { model: 'User', id: user._id } });

  return ok(res, {
    accessToken,
    refreshToken: raw,
    user: user.toJSON(),
    emailVerified: !!user.emailVerified
  });
};

/* =============== طلب/إعادة إرسال OTP =============== */
// POST /auth/verify-email/request  { email? }  // إذا مصادق استخدم req.auth.id
/* =============== طلب/إعادة إرسال OTP =============== */
// POST /auth/verify-email/request  { email? }  // إذا مصادق استخدم req.auth.id
exports.requestEmailVerification = async (req, res) => {
  let user;
  if (req.auth?.id) {
    user = await User.findById(req.auth.id);
  } else if (req.body?.email) {
    user = await User.findOne({ email: req.body.email });
  }
  if (!user) return error(res, 404, 'المستخدم غير موجود');
  if (user.emailVerified) {
    return ok(res, { alreadyVerified: true }, 'البريد موثّق بالفعل');
  }

  let otpRes;
  try {
    otpRes = await issueEmailOtp({ user, req });
  } catch (e) {
    if (e.message === 'MAIL_SEND_FAILED') {
      return error(res, 503, 'تعذر إرسال البريد الآن. حاول لاحقًا.');
    }
    throw e;
  }

  if (otpRes.throttled) {
    return error(res, 429, `يرجى الانتظار ${Math.ceil(otpRes.retryAfterMs / 1000)} ثانية قبل إعادة الإرسال`);
  }

  await logAudit(req, { action: 'email_verify_request', target: { model: 'User', id: user._id } });

  return ok(res, {
    maskedEmail: maskEmail(user.email),
    expiresInSec: Math.floor(EMAIL_OTP_TTL_MS / 1000),
    ...(otpRes.devPreviewUrl ? { devPreviewUrl: otpRes.devPreviewUrl } : {}),
    ...(otpRes.devNote ? { devNote: otpRes.devNote } : {}),
  }, 'تم إرسال رمز التحقق');
};


/* =============== تأكيد OTP =============== */
// POST /auth/verify-email/confirm { email?, otp }
exports.confirmEmailVerification = async (req, res) => {
  const { email, otp } = req.body;
  if (!otp) return error(res, 400, 'OTP مطلوب');

  let user;
  if (req.auth?.id) {
    user = await User.findById(req.auth.id);
  } else if (email) {
    user = await User.findOne({ email });
  }
  if (!user) return error(res, 404, 'المستخدم غير موجود');
  if (user.emailVerified) return ok(res, { emailVerified: true }, 'البريد موثّق بالفعل');

  const rec = await VerificationToken.findOne({
    userId: user._id,
    type: 'email',
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });

  if (!rec) return error(res, 400, 'رمز غير صالح أو منتهي');

  // تحقق من المحاولات
  if (typeof rec.attemptsLeft === 'number' && rec.attemptsLeft <= 0) {
    return error(res, 429, 'تم استنفاد المحاولات، اطلب رمزًا جديدًا');
  }

  // مقارنة آمنة
  const providedHashHex = sha256(String(otp));
  const okMatch = timingSafeEqual(
    Buffer.from(providedHashHex, 'hex'),
    Buffer.from(rec.tokenHash, 'hex')
  );

  if (!okMatch) {
    if (typeof rec.attemptsLeft === 'number') {
      rec.attemptsLeft = Math.max(0, (rec.attemptsLeft || EMAIL_OTP_MAX_ATTEMPTS) - 1);
      await rec.save();
    }
    return error(res, 400, 'OTP غير صحيح');
  }

  // نجاح → وثّق البريد
  user.emailVerified = true;
  user.emailVerifiedAt = new Date();
  await user.save();

  rec.usedAt = new Date();
  await rec.save();

  await logAudit(req, { action: 'email_verify_confirm', target: { model: 'User', id: user._id } });

  return ok(res, { emailVerified: true }, 'تم توثيق البريد بنجاح');
};
