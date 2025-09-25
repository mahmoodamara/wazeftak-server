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
// controllers/user.controller.js
const Joi = require('joi');


// بادئات إسرائيل المقبولة
const IL_PREFIXES = ['050','051','052','053','054','055','057','058','059'];

const schema = Joi.object({
  name: Joi.string().trim().min(2).max(120),
  phone: Joi.string().trim().allow('', null),
  city: Joi.string().trim().max(120).allow('', null),
  preferredLanguage: Joi.string().valid('ar','he','en'),
  locale: Joi.string().valid('ar','he','en'),
  defaultCvFileId: Joi.string().trim().allow('', null),
  // ✅ المهنة (مطلوبة لو عندك enum ثابت، أو اختيارية مع نص حر)
  profession: Joi.string().trim().min(2).max(100).allow('', null),
}).unknown(false);

function normalizeName(name) {
  if (!name) return name;
  const t = name.trim().replace(/\s+/g, ' ');
  return t;
}

function normalizePhoneIL(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D+/g, '');
  let local = null;

  if (/^0[5]\d{8}$/.test(digits)) {
    local = digits;
  } else if (/^(972)?5\d{8}$/.test(digits)) {
    const last10 = digits.slice(-10);
    local = '0' + last10;
  }

  if (local) {
    const prefix = local.slice(0,3);
    const body = local.slice(3);
    if (!IL_PREFIXES.includes(prefix)) return null;
    if (body.length !== 7) return null;
    return prefix + body;
  }
  return null;
}

exports.updateMe = async (req, res) => {
  const parsed = await schema.validateAsync(req.body || {}, { abortEarly: false });

  const updates = {};
  const $set = {};
  const $unset = {};

  // name
  if (Object.prototype.hasOwnProperty.call(parsed, 'name')) {
    const v = normalizeName(parsed.name);
    if (!v) {
      return res.status(422).json({ message: 'الاسم غير صالح' });
    }
    $set.name = v;
  }

  // locale / preferredLanguage
  let locale = parsed.locale || parsed.preferredLanguage;
  if (locale) $set.locale = locale;

  // city
  if (Object.prototype.hasOwnProperty.call(parsed, 'city')) {
    const v = (parsed.city || '').trim();
    if (!v) $unset.city = ''; else $set.city = v;
  }

  // phone
  if (Object.prototype.hasOwnProperty.call(parsed, 'phone')) {
    const normalized = normalizePhoneIL(parsed.phone);
    if (parsed.phone === '' || parsed.phone === null) {
      $unset.phone = '';
      $set.phoneVerified = false;
    } else {
      if (!normalized) {
        return res.status(422).json({ message: 'رقم الهاتف غير صالح. الرجاء إدخال رقم إسرائيلي يبدأ بـ 05X' });
      }
      $set.phone = normalized;
      $set.phoneVerified = false;
    }
  }

  // ✅ profession
  if (Object.prototype.hasOwnProperty.call(parsed, 'profession')) {
    const val = (parsed.profession || '').trim();
    if (!val) {
      $unset.profession = '';
    } else {
      $set.profession = val;
    }
  }

  // defaultCvFileId
  if (Object.prototype.hasOwnProperty.call(parsed, 'defaultCvFileId')) {
    const val = parsed.defaultCvFileId;
    if (val === '' || val === null) {
      $unset.defaultCvFileId = '';
    } else {
      if (!isObjectId(val)) {
        return res.status(422).json({ message: 'defaultCvFileId غير صالح' });
      }
      const f = await File.findById(val).select('ownerId scope deletedAt').lean();
      if (!f) return res.status(422).json({ message: 'الملف غير موجود' });
      if (String(f.ownerId) !== String(req.auth.id)) {
        return res.status(403).json({ message: 'لا تملك هذا الملف' });
      }
      if (f.scope !== 'cv') {
        return res.status(422).json({ message: 'الملف ليس من نوع CV' });
      }
      if (f.deletedAt) {
        return res.status(422).json({ message: 'الملف محذوف' });
      }
      $set.defaultCvFileId = val;
    }
  }

  if (Object.keys($set).length) updates.$set = $set;
  if (Object.keys($unset).length) updates.$unset = $unset;

  if (!updates.$set && !updates.$unset) {
    return ok(res, { user: await User.findById(req.auth.id).lean() });
  }

  try {
    const filter = { _id: req.auth.id };

    const user = await User.findOneAndUpdate(
      filter,
      updates,
      { new: true, runValidators: true, context: 'query', lean: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await logAudit(req, {
      action: 'update_user',
      target: { model: 'User', id: user._id },
      meta: { fields: Object.keys($set || {}).concat(Object.keys($unset || {})) }
    });

    await enrichUserCvMeta(user);

    return ok(res, { user });
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.phone) {
      return res.status(409).json({ message: 'رقم الهاتف مستخدم بالفعل' });
    }
    if (err?.name === 'ValidationError') {
      return res.status(422).json({ message: 'قيمة غير صالحة في بعض الحقول', details: err.errors });
    }
    return res.status(500).json({ message: 'تعذّر تحديث الحساب' });
  }
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
