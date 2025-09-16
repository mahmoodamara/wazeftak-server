const router = require('express').Router();
const { query, param } = require('express-validator');
const { validate } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/error');
const { auth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/auditLogController');

router.use(auth, requireRole('admin'));

router.get(
  '/',
  query('action').optional().isString(),
  query('source').optional().isIn(['api','web','admin','cli','job']),
  query('severity').optional().isIn(['info','warning','error','security']),
  query('success').optional().isBoolean().toBoolean(),
  query('targetModel').optional().isIn(['Job','Application','Company','User']),
  query('targetId').optional().isMongoId(),
  query('companyId').optional().isMongoId(),
  query('jobId').optional().isMongoId(),
  query('userId').optional().isMongoId(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  validate,
  asyncHandler(ctrl.list)
);

router.get('/:id', param('id').isMongoId(), validate, asyncHandler(ctrl.getById));

router.delete(
  '/',
  query('before').isISO8601(),
  validate,
  asyncHandler(ctrl.purgeBefore)
);

module.exports = router;
