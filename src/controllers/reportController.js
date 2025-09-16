const Report = require('../models/Report');
const { ok, created, withPagination } = require('../utils/responses');
const { parsePagination, paginateModel } = require('../utils/pagination');
const { logAudit } = require('../utils/audit');

exports.create = async (req, res) => {
  const doc = await Report.create({
    jobId: req.body.jobId,
    userId: req.auth?.id,
    reason: req.body.reason,
    note: req.body.note
  });
  await logAudit(req, { action: 'create_report', target: { model: 'Job', id: req.body.jobId }, meta: { reason: req.body.reason } });
  return created(res, { report: doc });
};

// Admin list/resolve
exports.list = async (req, res) => {
  const page = parsePagination(req.query);
  const filter = {};
  if (req.query.resolved) filter.resolved = req.query.resolved === 'true';
  const result = await paginateModel(Report, filter, page);
  return withPagination(res, result);
};

exports.resolve = async (req, res) => {
  const doc = await Report.findByIdAndUpdate(req.params.id, { $set: { resolved: true, resolvedAt: new Date() } }, { new: true });
  await logAudit(req, { action: 'resolve_report', target: { model: 'Job', id: doc.jobId } });
  return ok(res, { report: doc });
};
