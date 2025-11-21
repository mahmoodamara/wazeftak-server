// routes/auth.js
const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/error');
const { auth } = require('../middleware/auth');

const authCtrl = require('../controllers/authController');
const userCtrl = require('../controllers/userController'); // /me هنا

/* =============================================================================
   ⚙️ ثوابت
============================================================================= */
const ALLOWED_SIGNUP_ROLES = ['job_seeker', 'company'];

/* =============================================================================
   🔐 Auth: Register / Login / Tokens
============================================================================= */
router.post(
  '/register',
  // لا نسمح بتسجيل admin من الواجهة
  body('role')
    .customSanitizer((v) => String(v || '').toLowerCase())
    .isIn(ALLOWED_SIGNUP_ROLES)
    .withMessage('دور غير صالح')
    .bail(),
  body('name').trim().isString().isLength({ min: 2, max: 120 }),
  body('email').normalizeEmail().isEmail(),
  // توحيد سياسة كلمة المرور مع reset: 8+ وتحتوي صغير/كبير/رقم
  body('password')
    .isString()
    .isLength({ min: 8 })
    .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('كلمة المرور يجب أن تكون 8+ وتحتوي حرفًا صغيرًا وكبيرًا ورقمًا'),
  validate,
  asyncHandler(authCtrl.register)
);

router.post(
  '/login',
  body('email').normalizeEmail().isEmail(),
  body('password').isString().isLength({ min: 6 }),
  validate,
  asyncHandler(authCtrl.login)
);

router.post(
  '/refresh',
  body('refreshToken').trim().isString().isLength({ min: 20 }),
  validate,
  asyncHandler(authCtrl.refresh)
);

router.post(
  '/logout',
  body('refreshToken').trim().isString().isLength({ min: 20 }),
  validate,
  asyncHandler(authCtrl.logout)
);

router.post('/logout-all', auth, asyncHandler(authCtrl.logoutAll));

/* =============================================================================
   👤 Current User (me)
============================================================================= */
router.get('/me', auth, asyncHandler(userCtrl.me));

/* =============================================================================
   🔁 Password Reset (نسيت كلمة المرور)
============================================================================= */
// لا نكشف وجود البريد: OK عام دائمًا. email اختياري.
router.post(
  '/password/forgot',
  body('email').optional({ nullable: true }).normalizeEmail().isEmail(),
  validate,
  asyncHandler(authCtrl.requestPasswordReset)
);

// التحقق من صلاحية توكن إعادة التعيين
router.post(
  '/password/reset/verify',
  body('token').isString().isLength({ min: 20, max: 512 }),
  validate,
  asyncHandler(authCtrl.verifyPasswordResetToken)
);

// تنفيذ إعادة التعيين: token + newPassword (بنفس السياسة القوية)
router.post(
  '/password/reset',
  body('token').isString().isLength({ min: 20, max: 512 }),
  body('newPassword')
    .isString()
    .isLength({ min: 8 })
    .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('كلمة المرور يجب أن تكون 8+ وتحتوي حرفًا صغيرًا وكبيرًا ورقمًا'),
  validate,
  asyncHandler(authCtrl.resetPasswordWithToken)
);

/* =============================================================================
   ✉️ Email Verification via OTP
============================================================================= */
// إصدار/إعادة إرسال OTP (بدون مصادقة): يتطلب email
router.post(
  '/verify-email/request',
  body('email').normalizeEmail().isEmail(),
  validate,
  asyncHandler(authCtrl.requestEmailVerification)
);

// إصدار/إعادة إرسال OTP (مع مصادقة): يستخدم المستخدم الحالي
router.post('/verify-email/request/me', auth, asyncHandler(authCtrl.requestEmailVerification));

// ✅ مسار "مرن" اختياري: يقبل المصادقة أو email (يسهّل على الواجهة)
router.post(
  '/verify-email/request/flex',
  body('email').optional({ nullable: true }).normalizeEmail().isEmail(),
  validate,
  asyncHandler(authCtrl.requestEmailVerification)
);

// تأكيد OTP (بدون مصادقة): يتطلب email + otp (٦ أرقام)
router.post(
  '/verify-email/confirm',
  body('email').normalizeEmail().isEmail(),
  body('otp').isString().matches(/^\d{6}$/).withMessage('OTP يجب أن يكون 6 أرقام'),
  validate,
  asyncHandler(authCtrl.confirmEmailVerification)
);

// تأكيد OTP (مع مصادقة): يتطلب otp فقط (٦ أرقام)
router.post(
  '/verify-email/confirm/me',
  auth,
  body('otp').isString().matches(/^\d{6}$/).withMessage('OTP يجب أن يكون 6 أرقام'),
  validate,
  asyncHandler(authCtrl.confirmEmailVerification)
);

module.exports = router;
