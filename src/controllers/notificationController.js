const Notification = require('../models/Notification');
const { ok, withPagination, noContent } = require('../utils/responses');
const { parsePagination, paginateModel } = require('../utils/pagination');

exports.listMine = async (req, res) => {
  const page = parsePagination(req.query);
  const result = await paginateModel(Notification, { userId: req.auth.id }, page);
  return withPagination(res, result);
};

exports.markRead = async (req, res) => {
  const doc = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.auth.id },
    { $set: { read: true, readAt: new Date() } },
    { new: true }
  );
  return ok(res, { notification: doc });
};

exports.markAllRead = async (req, res) => {
  await Notification.updateMany(
    { userId: req.auth.id, read: false },
    { $set: { read: true, readAt: new Date() } }
  );
  return noContent(res);
};
