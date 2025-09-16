const router = require('express').Router();
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/error');
const { auth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/reportController');

// Create report (auth optional)
router.post(
  '/',
  auth, // ان أردت السماح لغير المسجلين احذف auth
  body('jobId').isMongoId(),
  body('reason').isIn(['spam','fake','inappropriate','other']),
  body('note').optional().isString().isLength({ max: 1000 }),
  validate,
  asyncHandler(ctrl.create)
);

// Admin list
router.get(
  '/',
  auth, requireRole('admin'),
  query('resolved').optional().isBoolean().toBoolean(),
  validate,
  asyncHandler(ctrl.list)
);

// Admin resolve
router.patch(
  '/:id/resolve',
  auth, requireRole('admin'),
  param('id').isMongoId(),
  validate,
  asyncHandler(ctrl.resolve)
);

module.exports = router;
