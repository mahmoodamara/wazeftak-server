const router = require('express').Router();
const { param } = require('express-validator');
const { validate } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/error');
const { auth } = require('../middleware/auth');
const ctrl = require('../controllers/refreshTokenController');

router.use(auth);

router.get('/', asyncHandler(ctrl.mySessions));
router.delete('/:id', param('id').isMongoId(), validate, asyncHandler(ctrl.revokeMine));
router.delete('/', asyncHandler(ctrl.revokeAllMine));

module.exports = router;
