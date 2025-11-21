// routes/leads.router.js
const express = require("express");
const router = express.Router();

// 👇 تأكد إن عندك هذا الموديل أو عدّل المسار حسب مشروعك
const Lead = require("../models/Lead");

/**
 * ✅ فلتر بسيط لحقول البودي المسموح نمرّرها
 */
function pickLeadPayload(body = {}) {
  const allowed = [
    "type",

    // مشترك
    "name",
    "phone",
    "email",
    "city",

    // باحث عن عمل
    "seeker_role",
    "seeker_experience",
    "seeker_notes",

    // صاحب شركة
    "company_name",
    "job_title",
    "job_type",
    "company_notes",
  ];

  const payload = {};
  for (const key of allowed) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== "") {
      payload[key] = body[key];
    }
  }
  return payload;
}

/**
 * ✅ فحص بسيط للبدي – تقدر تطوّره لاحقًا بـ Joi / Zod
 */
function validateLead(body = {}) {
  const errors = {};

  if (!body.name || !String(body.name).trim()) {
    errors.name = "الاسم مطلوب";
  }

  if (!body.phone || !String(body.phone).trim()) {
    errors.phone = "رقم الهاتف مطلوب";
  }

  if (!body.type || !["seeker", "company"].includes(body.type)) {
    errors.type = "نوع الطلب غير صحيح";
  }

  // لو في إيميل، تأكد إن شكله صحيح
  if (body.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      errors.email = "البريد الإلكتروني غير صالح";
    }
  }

  // تحقق خفيف لكل نوع
  if (body.type === "seeker") {
    if (!body.seeker_role || !String(body.seeker_role).trim()) {
      errors.seeker_role = "حدّد نوع الشغل اللي بتدور عليه";
    }
  }

  if (body.type === "company") {
    if (!body.company_name || !String(body.company_name).trim()) {
      errors.company_name = "اسم الشركة / المحل مطلوب";
    }
    if (!body.job_title || !String(body.job_title).trim()) {
      errors.job_title = "اسم الوظيفة مطلوب";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * ✅ POST /api/leads
 * يستقبل الطلب من صفحة اللاندينغ ويحفظه في الداتابيس
 */
router.post("/", async (req, res) => {
  try {
    const rawBody = req.body || {};

    // 1) فلترة وولتيد داتا
    const payload = pickLeadPayload(rawBody);

    // 2) فاليديشن
    const { valid, errors } = validateLead(payload);
    if (!valid) {
      return res.status(400).json({
        ok: false,
        message: "في حقول ناقصة أو غير صحيحة",
        errors,
      });
    }

    // 3) ميتاداتا: IP + User-Agent
    const ip =
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      null;

    const userAgent = req.headers["user-agent"] || null;

    const doc = new Lead({
      ...payload,
      meta: {
        ip,
        userAgent,
        referer: req.headers.referer || null,
      },
    });

    await doc.save();

    return res.status(201).json({
      ok: true,
      message: "تم استلام الطلب بنجاح.",
      leadId: doc._id,
    });
  } catch (err) {
    console.error("Error creating lead:", err);
    return res.status(500).json({
      ok: false,
      message: "صار خطأ داخلي، جرّب كمان مرة لاحقًا.",
    });
  }
});

module.exports = router;
