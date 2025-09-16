const router = require('express').Router();
const { param, query } = require('express-validator');
const { validate } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/error');
const { auth } = require('../middleware/auth');
const ctrl = require('../controllers/notificationController');

router.get(
  '/',
  auth,
  query('page').optional().isInt({ min: 1 }),
  validate,
  asyncHandler(ctrl.listMine)
);

router.patch(
  '/:id/read',
  auth,
  param('id').isMongoId(),
  validate,
  asyncHandler(ctrl.markRead)
);

router.patch(
  '/read-all',
  auth,
  validate,
  asyncHandler(ctrl.markAllRead)
);

module.exports = router;
