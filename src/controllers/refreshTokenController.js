const RefreshToken = require('../models/RefreshToken');
const { withPagination, ok, noContent } = require('../utils/responses');
const { parsePagination, paginateModel } = require('../utils/pagination');

/** GET /api/auth/sessions (للمستخدم الحالي) */
exports.mySessions = async (req, res) => {
  const page = parsePagination(req.query);
  const result = await paginateModel(
    RefreshToken,
    { userId: req.auth.id, revokedAt: { $exists: false } },
    { ...page, sort: { expiresAt: -1 } },
    'userAgent ip expiresAt createdAt'
  );
  return withPagination(res, result);
};

/** DELETE /api/auth/sessions/:id — إبطال جلسة واحدة للمستخدم الحالي */
exports.revokeMine = async (req, res) => {
  await RefreshToken.updateOne(
    { _id: req.params.id, userId: req.auth.id, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );
  return noContent(res);
};

/** DELETE /api/auth/sessions (body: all=true) — إنهاء كل الجلسات للمستخدم الحالي */
exports.revokeAllMine = async (req, res) => {
  await RefreshToken.updateMany(
    { userId: req.auth.id, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );
  return noContent(res);
};

/** (Admin) GET /api/admin/users/:userId/sessions */
exports.adminListByUser = async (req, res) => {
  const page = parsePagination(req.query);
  const result = await paginateModel(
    RefreshToken,
    { userId: req.params.userId },
    { ...page, sort: { createdAt: -1 } }
  );
  return withPagination(res, result);
};

/** (Admin) DELETE /api/admin/users/:userId/sessions */
exports.adminRevokeByUser = async (req, res) => {
  await RefreshToken.updateMany(
    { userId: req.params.userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );
  return noContent(res);
};
