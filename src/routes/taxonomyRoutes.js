const router = require('express').Router();
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/error');
const { auth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/taxonomyController');

// Public list
router.get(
  '/',
  query('type').optional().isIn(['city','field','skill','job_type','seniority','education','language','transport','benefit']),
  query('active').optional().isBoolean().toBoolean(),
  validate,
  asyncHandler(ctrl.list)
);

// Admin create/update/delete
router.post(
  '/',
  auth, requireRole('admin'),
  body('type').isIn(['city','field','skill','job_type','seniority','education','language','transport','benefit']),
  body('slug').isString(),
  body('label.ar').isString(),
  validate,
  asyncHandler(ctrl.create)
);

router.patch(
  '/:id',
  auth, requireRole('admin'),
  param('id').isMongoId(),
  validate,
  asyncHandler(ctrl.update)
);

router.delete(
  '/:id',
  auth, requireRole('admin'),
  param('id').isMongoId(),
  validate,
  asyncHandler(ctrl.remove)
);

module.exports = router;
