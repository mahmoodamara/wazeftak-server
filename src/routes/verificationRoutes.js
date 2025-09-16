const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/error');
const ctrl = require('../controllers/verificationController');

router.post(
  '/email/request',
  body('email').isEmail(),
  validate,
  asyncHandler(ctrl.requestEmail)
);

router.post(
  '/email/confirm',
  body('token').isString().isLength({ min: 10 }),
  validate,
  asyncHandler(ctrl.confirmEmail)
);

module.exports = router;
