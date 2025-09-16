const AuditLog = require('../models/AuditLog');
const { withPagination, ok, noContent } = require('../utils/responses');
const { parsePagination, paginateModel } = require('../utils/pagination');

/**
 * GET /api/admin/audit-logs
 * فلاتر مدعومة (اختيارية):
 * - action, source, success, severity
 * - targetModel, targetId, companyId, jobId, userId
 * - from, to (ISO dates)
 */
exports.list = async (req, res) => {
  const page = parsePagination(req.query);
  const f = {};

  if (req.query.action)     f.action = String(req.query.action).toLowerCase();
  if (req.query.source)     f.source = req.query.source;
  if (req.query.severity)   f.severity = req.query.severity;
  if (req.query.success)    f.success = req.query.success === 'true';

  if (req.query.targetModel) f['target.model'] = req.query.targetModel;
  if (req.query.targetId)    f['target.id']    = req.query.targetId;

  if (req.query.companyId) f.companyId = req.query.companyId;
  if (req.query.jobId)     f.jobId     = req.query.jobId;
  if (req.query.userId)    f.userId    = req.query.userId;

  // نطاق زمني
  if (req.query.from || req.query.to) {
    f.createdAt = {};
    if (req.query.from) f.createdAt.$gte = new Date(req.query.from);
    if (req.query.to)   f.createdAt.$lte = new Date(req.query.to);
  }

  const result = await paginateModel(
    AuditLog,
    f,
    { ...page, sort: { createdAt: -1 } },
    null,
    [] // لا populate افتراضيًا لأداء أفضل
  );
  return withPagination(res, result);
};

/** GET /api/admin/audit-logs/:id */
exports.getById = async (req, res) => {
  const log = await AuditLog.findById(req.params.id);
  return ok(res, { log });
};

/**
 * DELETE /api/admin/audit-logs?before=ISO
 * حذف قيود قديمة قبل تاريخ معيّن (تنظيف دوري)
 */
exports.purgeBefore = async (req, res) => {
  const before = req.query.before ? new Date(req.query.before) : null;
  if (!before || Number.isNaN(before.getTime())) {
    return res.status(400).json({ message: 'before (ISO date) مطلوب' });
  }
  await AuditLog.deleteMany({ createdAt: { $lt: before } });
  return noContent(res);
};
