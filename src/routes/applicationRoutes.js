// routes/applicationRoutes.js
const router = require('express').Router();
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/error');
const { auth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/applicationController');

/**
 * POST /api/applications
 * إنشاء طلب تقديم (باحث فقط)
 */
router.post(
  '/',
  auth,
  requireRole('job_seeker'),
  // الحقول الأساسية
  body('jobId').isMongoId().withMessage('jobId غير صالح'),
  body('message').optional({ nullable: true })
    .isString().withMessage('message يجب أن يكون نصاً')
    .trim().isLength({ max: 1500 }).withMessage('message بحد أقصى 1500 حرف'),

  // الـCV: إمّا ملف أو رابط
  body('cvFileId').optional({ nullable: true }).isMongoId().withMessage('cvFileId غير صالح'),
  body('cvUrl').optional({ nullable: true })
    .isString().trim().isLength({ max: 2048 })
    .isURL({ require_protocol: true }).withMessage('cvUrl يجب أن يكون http/https'),

  // ميتاداتا الـCV (اختيارية)
  body('cvName').optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
  body('cvMime').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body('cvSize').optional({ nullable: true }).isInt({ min: 0 }).toInt(),

  // XOR: إمّا ملف أو رابط وليس الاثنين
  body().custom(({ cvFileId, cvUrl }) => {
    if (cvFileId && cvUrl) throw new Error('أرسل إمّا ملف السيرة الذاتية أو رابطًا، وليس الاثنين');
    return true;
  }),

  validate,
  asyncHandler(ctrl.apply)
);

/**
 * GET /api/applications/me
 * طلبات المستخدم الحالي (باحث)
 * ?page=1&limit=10
 */
router.get(
  '/me',
  auth,
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  validate,
  asyncHandler(ctrl.myApplications)
);

router.get(
  '/check',
  auth,
  query('jobId').isMongoId().withMessage('jobId غير صالح'),
  validate,
  asyncHandler(ctrl.checkMineForJob)
);


/**
 * GET /api/applications
 * متقدمو وظيفة (شركة/أدمن) — نستخدم jobId في الـ query
 * ?jobId=...&page=1&limit=20
 */
router.get(
  '/',
  auth, requireRole('company', 'admin'),
  query('jobId').isMongoId().withMessage('jobId مطلوب/غير صالح'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
  asyncHandler(ctrl.listByJob) // الملكية تُفحَص داخل الكونترولر
);

/**
 * توافق رجعي: GET /api/applications/job/:jobId
 * يعاد توجيهها داخليًا لنفس منطق listByJob
 */
router.get(
  '/job/:jobId',
  auth, requireRole('company', 'admin'),
  param('jobId').isMongoId(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
  asyncHandler((req, res, next) => {
    req.query.jobId = req.params.jobId;
    return ctrl.listByJob(req, res, next);
  })
);

/**
 * PATCH /api/applications/:id/status
 * تحديث حالة الطلب (شركة/أدمن) — الملكية تُفحَص داخل الكونترولر
 */
router.patch(
  '/:id/status',
  auth, requireRole('company', 'admin'),
  param('id').isMongoId(),
  body('status').isIn(['pending','reviewed','interview','accepted','rejected']),
  validate,
  asyncHandler(ctrl.setStatus)
);

/**
 * DELETE /api/applications/:id
 * حذف طلبي (صاحب الطلب فقط) — التحقق داخل الكونترولر عبر userId
 */
router.delete(
  '/:id',
  auth,
  param('id').isMongoId(),
  validate,
  asyncHandler(ctrl.remove)
);

module.exports = router;
