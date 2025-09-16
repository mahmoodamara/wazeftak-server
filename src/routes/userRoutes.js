const router = require('express').Router();
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/error');
const { auth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/userController');

// Current user
router.get('/me', auth, asyncHandler(ctrl.getMe));

router.patch(
  '/me',
  auth,
  body('name').optional().isString().isLength({ min: 2, max: 120 }),
  body('phone').optional().isString().isLength({ min: 6, max: 40 }),
  body('city').optional().isString().isLength({ min: 2, max: 120 }),
  body('locale').optional().isIn(['ar','he','en']),
  validate,
  asyncHandler(ctrl.updateMe)
);

// Admin
router.get(
  '/',
  auth, requireRole('admin'),
  query('role').optional().isIn(['job_seeker','company','admin']),
  query('disabled').optional().isBoolean().toBoolean(),
  validate,
  asyncHandler(ctrl.list)
);

router.get("/stats", ctrl.getStats);


router.patch(
  '/:id/disabled',
  auth, requireRole('admin'),
  param('id').isMongoId(),
  body('disabled').isBoolean().toBoolean(),
  validate,
  asyncHandler(ctrl.setDisabled)
);

module.exports = router;
