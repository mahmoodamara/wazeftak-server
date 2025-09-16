// controllers/userController.js
const mongoose = require('mongoose');
const User = require('../models/User');
const File = require('../models/File');
const { ok, withPagination } = require('../utils/responses');
const { parsePagination, paginateModel } = require('../utils/pagination');
const { logAudit } = require('../utils/audit');

const isObjectId = (v) => mongoose.isValidObjectId(String(v || ''));

/** إثراء ميتاداتا الـCV على كائن المستخدم (originalName/size/downloadUrl) */
async function enrichUserCvMeta(user) {
  if (!user || !user.defaultCvFileId) return user;
  try {
    const f = await File.findById(user.defaultCvFileId)
      .select('originalName size mimeType visibility ownerId')
      .lean();
    if (f) {
      user.defaultCvOriginalName = f.originalName || 'CV';
      user.defaultCvSize = typeof f.size === 'number' ? f.size : undefined;
      user.defaultCvDownloadUrl = `/api/files/${f._id}/download`; // تنزيل آمن
    }
  } catch (_) { /* تجاهل الإثراء عند الفشل */ }
  return user;
}

/** GET /api/auth/me */
exports.me = async (req, res) => {
  const user = await User.findById(req.auth.id).lean();
  if (!user) return res.status(404).json({ message: 'User not found' });

  await enrichUserCvMeta(user);
  return ok(res, { user });
};

/** PATCH /api/users/me */
exports.updateMe = async (req, res) => {
  // حقول مسموحة بالتحديث
  const allowed = ['name', 'phone', 'city', 'preferredLanguage', 'defaultCvFileId'];
  const input = req.body || {};
  const set = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(input, k)) set[k] = input[k];
  }

  // معالجة defaultCvFileId إن تم تمريره
  const updates = {};
  if (Object.prototype.hasOwnProperty.call(set, 'defaultCvFileId')) {
    const val = set.defaultCvFileId;

    // تفريغ الـCV الافتراضي
    if (val === '' || val === null) {
      updates.$unset = { defaultCvFileId: '' };
    } else {
      // تحقق من صحة المعرّف والملكية والنطاق
      if (!isObjectId(val)) {
        return res.status(422).json({ message: 'defaultCvFileId غير صالح' });
      }
      const f = await File.findById(val).select('ownerId scope').lean();
      if (!f) {
        return res.status(422).json({ message: 'الملف غير موجود' });
      }
      if (String(f.ownerId) !== String(req.auth.id)) {
        return res.status(403).json({ message: 'لا تملك هذا الملف' });
      }
      if (f.scope !== 'cv') {
        return res.status(422).json({ message: 'الملف ليس من نوع CV' });
      }
      updates.$set = { ...(updates.$set || {}), defaultCvFileId: val };
    }
  }

  // حقول المستخدم الأخرى
  const otherFields = {};
  for (const k of ['name', 'phone', 'city', 'preferredLanguage']) {
    if (Object.prototype.hasOwnProperty.call(set, k) && set[k] !== undefined) {
      otherFields[k] = set[k];
    }
  }
  if (Object.keys(otherFields).length) {
    updates.$set = { ...(updates.$set || {}), ...otherFields };
  }

  const user = await User.findByIdAndUpdate(req.auth.id, updates, { new: true, lean: true });
  if (!user) return res.status(404).json({ message: 'User not found' });

  await logAudit(req, { action: 'update_user', target: { model: 'User', id: user._id } });

  await enrichUserCvMeta(user);
  return ok(res, { user });
};

exports.getStats = async (req, res) => {
  try {
    const seekersCount = await User.countDocuments({ role: "job_seeker" });
    const companiesCount = await User.countDocuments({ role: "company" });

    return ok(res, {
      seekersCount,
      companiesCount,
      totalUsers: seekersCount + companiesCount,
    });
  } catch (err) {
    console.error("User.getStats error:", err);
    return res.status(500).json({ message: "حدث خطأ أثناء جلب الإحصائيات" });
  }
};

/** Admin: list users */
exports.list = async (req, res) => {
  const page = parsePagination(req.query);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.disabled != null) filter.disabled = req.query.disabled === 'true';
  const result = await paginateModel(User, filter, page, '-passwordHash');
  return withPagination(res, result);
};

/** Admin: disable/enable user */
exports.setDisabled = async (req, res) => {
  const { id } = req.params;
  const { disabled } = req.body;
  const user = await User.findByIdAndUpdate(
    id,
    { $set: { disabled: !!disabled } },
    { new: true, lean: true }
  );
  if (!user) return res.status(404).json({ message: 'User not found' });

  await logAudit(req, {
    action: disabled ? 'disable_user' : 'enable_user',
    target: { model: 'User', id }
  });

  return ok(res, { user });
};
