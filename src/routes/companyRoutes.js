const router = require('express').Router();
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/error');
const { auth, requireRole, requireCompanyOwnership, loadOwnedCompany } = require('../middleware/auth');
const ctrl = require('../controllers/companyController');

// Create new company (owner = current user)
router.post(
  '/',
  auth, requireRole('company','admin'),
  body('name').isString().isLength({ min: 2, max: 120 }),
  body('city').isString().isLength({ min: 2 }),
  validate,
  asyncHandler(ctrl.create)
);

// My company (owner)
router.get('/me', auth, requireRole('company','admin'), loadOwnedCompany, asyncHandler(ctrl.getMine));

// Public company by id
router.get('/:id', param('id').isMongoId(), validate, asyncHandler(ctrl.getById));

// Update company (owner or admin)
router.patch(
  '/:id',
  auth,
  requireCompanyOwnership({ from: 'params', key: 'id' }),
  param('id').isMongoId(),
  // allowed fields are validated loosely here
  body('name').optional().isString().isLength({ min: 2, max: 120 }),
  body('slug').optional().isString().isLength({ min: 2, max: 140 }),
  body('city').optional().isString(),
  body('citySlug').optional().isString(),
  body('address').optional().isString(),
  body('about').optional().isString(),
  body('logoUrl').optional().isString(),
  body('coverUrl').optional().isString(),
  body('contactEmail').optional().isEmail(),
  body('contactPhone').optional().isString(),
  body('website').optional().isString(),
  body('socials').optional().isObject(),
  body('applicationChannel').optional().isIn(['in_app','email','whatsapp','external_url']),
  body('applicationTarget').optional().isString(),
  body('status').optional().isIn(['active','suspended']),
  validate,
  asyncHandler(ctrl.update)
);

// Admin: verify/unverify
router.patch(
  '/:id/verify',
  auth, requireRole('admin'),
  param('id').isMongoId(),
  body('verified').isBoolean().toBoolean(),
  validate,
  asyncHandler(ctrl.setVerified)
);

// Public list
router.get(
  '/',
  query('q').optional().isString().trim().isLength({ max: 120 }),
  query('city').optional().isString(),
  query('verified').optional().isBoolean().toBoolean(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
  asyncHandler(ctrl.list)
);

// Stats
router.get('/:id/stats', param('id').isMongoId(), validate, asyncHandler(ctrl.stats));
// Company Jobs (public) + My Company Jobs (owner/admin)
router.get(
  '/:id/jobs',
  param('id').isMongoId(),
  // فلاتر اختيارية
  query('q').optional().isString().trim().isLength({ max: 120 }),
  query('city').optional().isString(),
  query('jobTypeSlug').optional().isString(),
  query('seniority').optional().isString(),
  query('fieldSlug').optional().isString(),
  query('skillSlug').optional().isString(),
  // دعم CSV: fieldSlugs, skillSlugs → "slug1,slug2,slug3"
  query('fieldSlugs').optional().isString(),
  query('skillSlugs').optional().isString(),
  // مفاتيح رؤية إضافية (يتم تفعيلها فقط لمالك الشركة/الأدمن داخل الـ controller)
  query('archived').optional().isBoolean().toBoolean(),
  query('status').optional().isIn(['open','closed','paused','draft']),
  query('isApproved').optional().isBoolean().toBoolean(),
  // فرز وترقيم
  query('sortBy').optional().isIn(['createdAt','updatedAt','views','applicationsCount','isFeatured']),
  query('sortDir').optional().isIn(['asc','desc']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
  asyncHandler(ctrl.listCompanyJobs)   // 👈 يتطلب وجود ctrl.listCompanyJobs
);

router.get(
  '/me/jobs',
  auth, requireRole('company','admin'),
  // نفس الفلاتر (يُسمح للمالك/الأدمن بالتحكم في archived/status/isApproved)
  query('q').optional().isString().trim().isLength({ max: 120 }),
  query('city').optional().isString(),
  query('jobTypeSlug').optional().isString(),
  query('seniority').optional().isString(),
  query('fieldSlug').optional().isString(),
  query('skillSlug').optional().isString(),
  query('fieldSlugs').optional().isString(),
  query('skillSlugs').optional().isString(),
  query('archived').optional().isBoolean().toBoolean(),
  query('status').optional().isIn(['open','closed','paused','draft']),
  query('isApproved').optional().isBoolean().toBoolean(),
  query('sortBy').optional().isIn(['createdAt','updatedAt','views','applicationsCount','isFeatured']),
  query('sortDir').optional().isIn(['asc','desc']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
  asyncHandler(ctrl.listMyJobs)        // 👈 يتطلب وجود ctrl.listMyJobs
);

module.exports = router;
