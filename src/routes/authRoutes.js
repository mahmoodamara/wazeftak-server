// routes/auth.js
const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/error');
const { auth } = require('../middleware/auth');

const authCtrl = require('../controllers/authController');
const userCtrl = require('../controllers/userController'); // ← me هنا

const { ROLES } = require('../utils/roles');

/* ===================== Auth: Register / Login / Tokens ===================== */
router.post(
  '/register',
  body('role').isIn(ROLES).withMessage('دور غير صالح').bail(),
  body('name').trim().isString().isLength({ min: 2, max: 120 }),
  body('email').normalizeEmail().isEmail(),
  body('password').isString().isLength({ min: 6 }),
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

/* ============================ Current User (me) ============================ */
// ربط /me مع userController.me لتفادي الخلط مع authController
router.get('/me', auth, asyncHandler(userCtrl.me));

/* =========================== Password Reset (اختياري) =========================== */
router.post(
  '/password/request-reset',
  body('email').normalizeEmail().isEmail(),
  validate,
  asyncHandler(authCtrl.requestPasswordReset)
);

router.post(
  '/password/reset',
  body('token').isString().isLength({ min: 10 }),
  body('newPassword').isString().isLength({ min: 6 }),
  validate,
  asyncHandler(authCtrl.resetPassword)
);

/* ======================= Email Verification via OTP ======================== */
/**
 * إصدار/إعادة إرسال OTP بدون مصادقة: يتطلب email
 * Controller: authCtrl.requestEmailVerification
 */
router.post(
  '/verify-email/request',
  body('email').normalizeEmail().isEmail(),
  validate,
  asyncHandler(authCtrl.requestEmailVerification)
);

/**
 * إصدار/إعادة إرسال OTP مع مصادقة: يستخدم المستخدم الحالي (لا يحتاج email)
 */
router.post(
  '/verify-email/request/me',
  auth,
  asyncHandler(authCtrl.requestEmailVerification)
);

/**
 * تأكيد OTP بدون مصادقة: يتطلب email + otp (٦ أرقام)
 */
router.post(
  '/verify-email/confirm',
  body('email').normalizeEmail().isEmail(),
  body('otp')
    .isString()
    .matches(/^\d{6}$/)
    .withMessage('OTP يجب أن يكون 6 أرقام'),
  validate,
  asyncHandler(authCtrl.confirmEmailVerification)
);

/**
 * تأكيد OTP مع مصادقة: يتطلب otp فقط (٦ أرقام)
 */
router.post(
  '/verify-email/confirm/me',
  auth,
  body('otp')
    .isString()
    .matches(/^\d{6}$/)
    .withMessage('OTP يجب أن يكون 6 أرقام'),
  validate,
  asyncHandler(authCtrl.confirmEmailVerification)
);

module.exports = router;
