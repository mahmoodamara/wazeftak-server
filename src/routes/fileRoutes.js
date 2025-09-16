const router = require('express').Router();
const multer = require('multer');
const { param, query, body } = require('express-validator');
const { validate } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/error');
const { auth } = require('../middleware/auth');
const ctrl = require('../controllers/fileController');

// قيم ثابتة
const ALLOWED_SCOPES = ['cv','company_logo','job_attachment','generic'];
const ALLOWED_VIS    = ['private','public'];
const LINK_MODELS    = ['Job','Company','Application','User'];

// Multer (ذاكرة) — سنكتب الملف للقرص داخل controller
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5MB, ملف واحد
  // ملاحظة: لا نستخدم fileFilter مع scope هنا لأن req.body لم يُقرأ بعد
});

/**
 * POST /api/files/upload
 */
router.post(
  '/upload',
  auth,
  upload.single('file'),
  // حقول نصية تأتي من multipart
  body('scope').optional().isIn(ALLOWED_SCOPES),
  body('visibility').optional().isIn(ALLOWED_VIS),
  body('linkToModel').optional().isIn(LINK_MODELS),
  body('linkToId').optional().isMongoId(),
  // تحقق ترابطي: إن ذُكر linkToModel يجب ذكر linkToId والعكس
  body().custom(({ linkToModel, linkToId }) => {
    if ((linkToModel && !linkToId) || (!linkToModel && linkToId)) {
      throw new Error('linkToModel و linkToId يجب أن يأتيا معًا');
    }
    return true;
  }),
  validate,
  asyncHandler(ctrl.upload)
);

/**
 * GET /api/files
 * لائحة ملفات المستخدم
 */
router.get(
  '/',
  auth,
  query('scope').optional().isIn(ALLOWED_SCOPES),
  query('visibility').optional().isIn(ALLOWED_VIS),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
  asyncHandler(ctrl.listMine)
);

/**
 * DELETE /api/files/:id
 */
router.delete(
  '/:id',
  auth,
  param('id').isMongoId(),
  validate,
  asyncHandler(ctrl.remove)
);

/**
 * GET /api/files/:id/download
 */
router.get('/:id/download', auth, param('id').isMongoId(), validate, asyncHandler(ctrl.download));
router.get(
  '/:id',
  auth, // إن أردته عامًا للملفات public فقط، يمكنك إزالة auth لأن التحقق داخل controller
  param('id').isMongoId(),
  validate,
  asyncHandler(ctrl.readOne)
);
module.exports = router;
