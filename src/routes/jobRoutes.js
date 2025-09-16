// routes/jobRoutes.js
const router = require('express').Router();
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/error');
const { auth, requireRole,optionalAuth } = require('../middleware/auth');
const ctrl = require('../controllers/jobController');


// GET /api/jobs — عامة + فلاتر + ترقيم + ترتيب
router.get(
  '/',
  // فلاتر عامة
  query('companyId').optional().isMongoId(),
  query('city').optional().isString(),
  query('jobTypeSlug').optional().isString(),
  query('seniority').optional().isString(),
  query('fieldSlug').optional().isString(),     // مفرد
  query('skillSlug').optional().isString(),     // مفرد
  query('fieldSlugs').optional().isString(),    // CSV
  query('skillSlugs').optional().isString(),    // CSV
  query('q').optional().isString(),
  query('status').optional().isIn(['open','closed','archived','active','pending','draft']),
  // ترقيم
  query('page').optional().toInt().isInt({ min: 1 }),
  query('limit').optional().toInt().isInt({ min: 1, max: 100 }),
  // ترتيب
  query('sort').optional().isIn(['createdAt','isFeatured','viewsCount','applicantsCount']),
  query('dir').optional().isIn(['asc','desc']),
  validate,
  asyncHandler(ctrl.list)
);

router.get(
  '/jobs2',
  // فلاتر عامة
  query('companyId').optional().isMongoId(),
  query('city').optional().isString(),
  query('jobTypeSlug').optional().isString(),
  query('seniority').optional().isString(),
  query('fieldSlug').optional().isString(),     // مفرد
  query('skillSlug').optional().isString(),     // مفرد
  query('fieldSlugs').optional().isString(),    // CSV
  query('skillSlugs').optional().isString(),    // CSV
  query('q').optional().isString(),
  query('status').optional().isIn(['open','closed','archived','active','pending','draft']),
  // ترقيم
  query('page').optional().toInt().isInt({ min: 1 }),
  query('limit').optional().toInt().isInt({ min: 1, max: 100 }),
  // ترتيب
  query('sort').optional().isIn(['createdAt','isFeatured','viewsCount','applicantsCount']),
  query('dir').optional().isIn(['asc','desc']),
  validate,
  asyncHandler(ctrl.list2)
);

router.get('/count', ctrl.count);


// GET /api/jobs/:id — عامة
router.get('/:id', param('id').isMongoId(), validate, asyncHandler(ctrl.getById));

// POST /api/jobs — إنشاء للشركة المملوكة للمستخدم (city مطلوبة)
router.post(
  '/',
  auth, requireRole('company','admin'),
  body('title').isString().trim().isLength({ min: 3, max: 120 }),
  body('description').isString().trim().isLength({ min: 10, max: 8000 }),
  body('city').isString().trim().isLength({ min: 2 }), // ✅ مطلوبة حسب الـ schema
  body('jobTypeSlug').optional().isString().trim(),
  body('seniority').optional().isString().trim(),
  body('type').optional().isIn(['full_time','part_time','contract','internship','temporary']),
  body('tags').optional().isArray(),
  body('tags.*').optional().isString(),
  body('fieldSlugs').optional().isArray(),
  body('fieldSlugs.*').optional().isString(),
  body('skillSlugs').optional().isArray(),
  body('skillSlugs.*').optional().isString(),
  body('applyMethod').optional().isIn(['in_app','email','whatsapp','external_url']),
  body('applyTarget').optional().isString(),
  validate,
  asyncHandler(ctrl.create)
);

// PATCH /api/jobs/:id — تحديث عام + يدعم الأرشفة عبر body.archived
router.patch(
  '/:id',
  auth, requireRole('company','admin'),
  param('id').isMongoId(),
  body('title').optional().isString().trim().isLength({ min: 3, max: 120 }),
  body('description').optional().isString().trim().isLength({ min: 10, max: 8000 }),
  body('city').optional().isString().trim().isLength({ min: 2 }),
  body('jobTypeSlug').optional().isString().trim(),
  body('seniority').optional().isString().trim(),
  body('type').optional().isIn(['full_time','part_time','contract','internship','temporary']),
  body('tags').optional().isArray(),
  body('tags.*').optional().isString(),
  body('fieldSlugs').optional().isArray(),
  body('fieldSlugs.*').optional().isString(),
  body('skillSlugs').optional().isArray(),
  body('skillSlugs.*').optional().isString(),
  body('applyMethod').optional().isIn(['in_app','email','whatsapp','external_url']),
  body('applyTarget').optional().isString(),
  body('archived').optional().isBoolean().toBoolean(),
  body('status').optional().isIn(['open','closed']),
  body('isApproved').optional().isBoolean().toBoolean(),
  validate,
  asyncHandler(ctrl.update)
);

// توافق رجعي: /archive /unarchive
router.patch('/:id/archive',
  auth, requireRole('company','admin'),
  param('id').isMongoId(),
  validate,
  asyncHandler((req,res,next)=>{ req.body.archived = true; return ctrl.update(req,res,next); })
);
router.patch('/:id/unarchive',
  auth, requireRole('company','admin'),
  param('id').isMongoId(),
  validate,
  asyncHandler((req,res,next)=>{ req.body.archived = false; return ctrl.update(req,res,next); })
);

// PATCH /api/jobs/:id/status — تعيين open/closed
router.patch(
  '/:id/status',
  auth, requireRole('company','admin'),
  param('id').isMongoId(),
  body('status').isIn(['open','closed']),
  validate,
  asyncHandler(ctrl.setStatus)
);

// حذف (نوصي بالأرشفة بدل الحذف)
router.delete('/:id',
  auth, requireRole('company','admin'),
  param('id').isMongoId(),
  validate,
  asyncHandler(ctrl.remove)
);
router.post('/:id/view', ctrl.incrementViews);

module.exports = router;
