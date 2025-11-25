// middleware/auth.js
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { JWT_SECRET } = require("../config/env");
const User = require("../models/User");
const Company = require("../models/Company");

/**
 * ✅ مصادقة إلزامية:
 * - تقرأ توكن الـ JWT من Authorization: Bearer <token>
 * - تتحقق منه
 * - تحمّل المستخدم من الـ DB
 * - تضع:
 *    req.auth = { id, role }
 *    req.currentUser = user (بدون passwordHash لأننا عاملين .lean())
 */
async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "غير مخوّل" });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET); // { id, role, iat, exp }
    } catch {
      return res.status(401).json({ message: "رمز غير صالح" });
    }

    // تحميل المستخدم للتأكد من وجوده وعدم تعطيله
    const user = await User.findById(payload.id).lean();
    if (!user) {
      return res.status(401).json({ message: "المستخدم غير موجود" });
    }
    if (user.disabled) {
      return res.status(403).json({ message: "الحساب معطّل" });
    }

    req.auth = { id: String(user._id), role: user.role };
    req.currentUser = user;
    next();
  } catch (e) {
    next(e);
  }
}

/**
 * ✅ مصادقة اختيارية (متسامحة):
 * - إن لم يوجد توكن → نكمل كزائر بدون أي خطأ
 * - إن كان التوكن تالفًا → نتجاهله ونكمل كزائر (بدون 401)
 * - إن كان صالحًا → نملأ req.auth / req.currentUser
 */
async function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    // لا يوجد توكن → نكمل كزائر
    if (!token) return next();

    // جرّب التحقق بدون فرض 401
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      // توكن تالف → اعتبره كأنّه غير موجود
      return next();
    }

    const user = await User.findById(payload.id).lean();
    if (user && !user.disabled) {
      req.auth = { id: String(user._id), role: user.role };
      req.currentUser = user;
    }

    return next();
  } catch {
    // أي خطأ غير متوقع → لا تُسقط الطلب العام أبدًا
    return next();
  }
}

/**
 * ✅ التحقق من الأدوار
 * usage: requireRole('admin', 'company')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth?.role) {
      return res.status(401).json({ message: "غير مخوّل" });
    }

    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ message: "صلاحيات غير كافية" });
    }

    next();
  };
}

/**
 * ✅ مختصر جاهز للأدمن فقط
 * usage: router.get('/admin', auth, requireAdmin, handler)
 */
function requireAdmin(req, res, next) {
  return requireRole("admin")(req, res, next);
}

/**
 * ✅ التحقق أن المستخدم يملك الشركة المستهدفة
 *    أو لديه دور أعلى (admin)
 *
 * usage:
 *   - requireCompanyOwnership({ from: 'params', key: 'companyId' })
 *   - requireCompanyOwnership('job', 'jobId')
 *   - requireCompanyOwnership('application', 'id')
 */
function requireCompanyOwnership(kindOrOpts, maybeKey) {
  return async (req, res, next) => {
    try {
      if (!req.auth?.id) {
        return res.status(401).json({ message: "غير مخوّل" });
      }

      // الأدمن دائمًا مسموح
      if (req.auth.role === "admin") return next();

      // 1) صيغة كائن { from, key } → تحقّق companyId مباشر
      if (kindOrOpts && typeof kindOrOpts === "object") {
        const { from = "params", key = "companyId" } = kindOrOpts;
        const value = req[from]?.[key];

        if (!value || !mongoose.isValidObjectId(value)) {
          return res.status(400).json({ message: "companyId غير صالح" });
        }

        const company = await Company.findById(value)
          .select("ownerId")
          .lean();

        if (!company) {
          return res.status(404).json({ message: "الشركة غير موجودة" });
        }

        if (String(company.ownerId) !== req.auth.id) {
          return res.status(403).json({ message: "ليست شركتك" });
        }

        return next();
      }

      // 2) صيغة ('job', 'jobId') → تحقّق ملكية الوظيفة
      if (kindOrOpts === "job") {
        const key = maybeKey || "jobId";
        const jobId =
          req.params?.[key] || req.body?.[key] || req.query?.[key];

        if (!jobId || !mongoose.isValidObjectId(jobId)) {
          return res.status(400).json({ message: "jobId غير صالح" });
        }

        const Job = mongoose.model("Job");
        const job = await Job.findById(jobId)
          .select("companyId")
          .lean();

        if (!job) {
          return res.status(404).json({ message: "الوظيفة غير موجودة" });
        }

        const company = await Company.findOne({
          _id: job.companyId,
          ownerId: req.auth.id,
        })
          .select("_id")
          .lean();

        if (!company) {
          return res.status(403).json({ message: "ليست شركتك" });
        }

        return next();
      }

      // 3) صيغة ('application', 'id') → تحقّق ملكية طلب التقديم عبر وظيفته
      if (kindOrOpts === "application") {
        const key = maybeKey || "id";
        const appId =
          req.params?.[key] || req.body?.[key] || req.query?.[key];

        if (!appId || !mongoose.isValidObjectId(appId)) {
          return res
            .status(400)
            .json({ message: "applicationId غير صالح" });
        }

        const Application = mongoose.model("Application");
        const app = await Application.findById(appId)
          .select("jobId")
          .lean();

        if (!app) {
          return res.status(404).json({ message: "الطلب غير موجود" });
        }

        const Job = mongoose.model("Job");
        const job = await Job.findById(app.jobId)
          .select("companyId")
          .lean();

        if (!job) {
          return res.status(404).json({ message: "الوظيفة غير موجودة" });
        }

        const company = await Company.findOne({
          _id: job.companyId,
          ownerId: req.auth.id,
        })
          .select("_id")
          .lean();

        if (!company) {
          return res.status(403).json({ message: "ليست شركتك" });
        }

        return next();
      }

      // إن مرّت صيغة غير مدعومة
      return res.status(400).json({
        message: "استخدام غير مدعوم في requireCompanyOwnership",
      });
    } catch (e) {
      next(e);
    }
  };
}

/**
 * ✅ التحقق من ملكية مورد مرتبط بالمستخدم (userId مثلاً)
 *
 * usage:
 *   requireOwnership({
 *     model: 'Application',
 *     idFrom: { from: 'params', key: 'id' },
 *     ownerField: 'userId'
 *   })
 */
function requireOwnership({
  model,
  idFrom = { from: "params", key: "id" },
  ownerField = "userId",
}) {
  return async (req, res, next) => {
    try {
      if (!req.auth?.id) {
        return res.status(401).json({ message: "غير مخوّل" });
      }

      // الأدمن دائمًا مسموح
      if (req.auth.role === "admin") return next();

      const Model = mongoose.model(model);
      const resourceId = req[idFrom.from]?.[idFrom.key];

      if (!resourceId || !mongoose.isValidObjectId(resourceId)) {
        return res.status(400).json({ message: "معرّف غير صالح" });
      }

      const doc = await Model.findById(resourceId)
        .select(ownerField)
        .lean();

      if (!doc) {
        return res.status(404).json({ message: "المورد غير موجود" });
      }

      if (String(doc[ownerField]) !== req.auth.id) {
        return res.status(403).json({ message: "ليست ملكيتك" });
      }

      next();
    } catch (e) {
      next(e);
    }
  };
}

/**
 * ✅ تحميل الشركة المملوكة للمستخدم الحالي (إن وُجدت)
 * - يعمل فقط لو الدور 'company'
 * - يضع req.ownedCompanyId للاستخدام في الراوتر/الكونترولر
 */
async function loadOwnedCompany(req, _res, next) {
  try {
    if (!req.auth?.id) return next();
    if (req.auth.role !== "company") return next();

    const company = await Company.findOne({ ownerId: req.auth.id })
      .select("_id")
      .lean();

    if (company) {
      req.ownedCompanyId = String(company._id);
    }

    next();
  } catch (e) {
    next(e);
  }
}

module.exports = {
  auth,
  optionalAuth,
  requireRole,
  requireAdmin,
  requireCompanyOwnership,
  requireOwnership,
  loadOwnedCompany,
};
