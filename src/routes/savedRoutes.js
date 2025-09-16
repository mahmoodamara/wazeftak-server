// routes/saved.js
const router = require('express').Router();
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/error');
const { auth } = require('../middleware/auth');
const ctrl = require('../controllers/savedController');

// =============================================================================
// 🔒 تطبيق middleware المصادقة على جميع المسارات
// =============================================================================
router.use(auth);

// =============================================================================
// 📊 مسارات الإحصائيات والبيانات العامة
// =============================================================================

/**
 * GET /api/saved-jobs/stats
 * احصل على إحصائيات الوظائف المحفوظة للمستخدم
 */
router.get(
  '/stats',
  asyncHandler(ctrl.stats)
);

// =============================================================================
// 🔍 مسارات الفحص والاستعلام
// =============================================================================

/**
 * GET /api/saved-jobs/check/:jobId
 * فحص ما إذا كانت وظيفة محددة محفوظة
 */
router.get(
  '/check/:jobId',
  param('jobId')
    .isMongoId()
    .withMessage('معرف الوظيفة غير صحيح'),
  validate,
  asyncHandler(ctrl.isSaved)
);

/**
 * POST /api/saved-jobs/bulk-check
 * فحص حالة عدة وظائف دفعة واحدة
 */
router.post(
  '/bulk-check',
  body('jobIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('jobIds يجب أن تكون مصفوفة تحتوي على 1-100 عنصر'),
  body('jobIds.*')
    .isMongoId()
    .withMessage('جميع معرفات الوظائف يجب أن تكون صحيحة'),
  validate,
  asyncHandler(ctrl.bulkStatus)
);

// =============================================================================
// 📝 المسارات الأساسية (CRUD)
// =============================================================================

/**
 * POST /api/saved-jobs
 * حفظ وظيفة جديدة
 */
router.post(
  '/',
  body('jobId')
    .isMongoId()
    .withMessage('معرف الوظيفة مطلوب ويجب أن يكون صحيحاً')
    .notEmpty()
    .withMessage('معرف الوظيفة لا يمكن أن يكون فارغاً'),
  validate,
  asyncHandler(ctrl.save)
);

/**
 * GET /api/saved-jobs
 * احصل على قائمة الوظائف المحفوظة مع pagination
 */
router.get(
  '/',
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('رقم الصفحة يجب أن يكون عدد صحيح أكبر من 0')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('حد النتائج يجب أن يكون بين 1 و 50')
    .toInt(),
  query('sort')
    .optional()
    .isIn(['createdAt', '-createdAt', 'title', '-title'])
    .withMessage('خيارات الترتيب: createdAt, -createdAt, title, -title'),
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('نص البحث يجب أن يكون بين 1-100 حرف'),
  validate,
  asyncHandler(ctrl.list)
);

/**
 * DELETE /api/saved-jobs/:jobId
 * إزالة وظيفة من المحفوظات
 */
router.delete(
  '/:jobId',
  param('jobId')
    .isMongoId()
    .withMessage('معرف الوظيفة غير صحيح'),
  validate,
  asyncHandler(ctrl.unsave)
);

// =============================================================================
// 🧹 مسارات الصيانة والإدارة
// =============================================================================

/**
 * DELETE /api/saved-jobs/cleanup
 * تنظيف الوظائف المحفوظة غير المتاحة
 */
router.delete(
  '/cleanup',
  asyncHandler(ctrl.cleanup)
);

// =============================================================================
// 🔄 مسارات متوافقة مع الإصدارات السابقة (للتوافق مع الكود القديم)
// =============================================================================

/**
 * GET /api/saved-jobs/status/:jobId
 * مسار بديل لفحص حالة الحفظ (للتوافق مع الكود القديم)
 */
router.get(
  '/status/:jobId',
  param('jobId')
    .isMongoId()
    .withMessage('معرف الوظيفة غير صحيح'),
  validate,
  asyncHandler(ctrl.isSaved)
);

/**
 * POST /api/saved-jobs/bulk/status
 * مسار بديل للفحص المتعدد (للتوافق مع الكود القديم)
 */
router.post(
  '/bulk/status',
  body('jobIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('jobIds يجب أن تكون مصفوفة تحتوي على 1-100 عنصر'),
  body('jobIds.*')
    .isMongoId()
    .withMessage('جميع معرفات الوظائف يجب أن تكون صحيحة'),
  validate,
  asyncHandler(ctrl.bulkStatus)
);

// =============================================================================
// 🛡️ مسارات إضافية للأمان والتحكم
// =============================================================================

/**
 * POST /api/saved-jobs/toggle
 * تبديل حالة الحفظ (حفظ أو إزالة)
 */
router.post(
  '/toggle',
  body('jobId').isMongoId().withMessage('معرف الوظيفة مطلوب ويجب أن يكون صحيحاً'),
  validate,
  asyncHandler(ctrl.toggle) // ✅ استخدم الكنترولر الجديد
);
/**
 * GET /api/saved-jobs/count
 * احصل على عدد الوظائف المحفوظة فقط
 */
router.get(
  '/count',
  asyncHandler(async (req, res) => {
    const userId = req.auth.id;
    const SavedJob = require('../models/SavedJob');
    const count = await SavedJob.countDocuments({ userId });
    const { ok } = require('../utils/responses');
    return ok(res, { count });
  })
);

// =============================================================================
// ⚠️ معالج الأخطاء للمسارات غير الموجودة
// =============================================================================
router.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'المسار غير موجود',
    availableRoutes: [
      'GET /api/saved-jobs - قائمة المحفوظات',
      'POST /api/saved-jobs - حفظ وظيفة',
      'DELETE /api/saved-jobs/:jobId - إزالة حفظ',
      'GET /api/saved-jobs/stats - الإحصائيات',
      'GET /api/saved-jobs/check/:jobId - فحص حالة وظيفة',
      'POST /api/saved-jobs/bulk-check - فحص متعدد',
      'DELETE /api/saved-jobs/cleanup - تنظيف المحفوظات',
      'POST /api/saved-jobs/toggle - تبديل حالة الحفظ',
      'GET /api/saved-jobs/count - عدد المحفوظات'
    ]
  });
});

module.exports = router;