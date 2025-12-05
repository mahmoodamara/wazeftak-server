// routes/leads.router.js
const express = require("express");
const router = express.Router();

const Lead = require("../models/Lead");
const { auth, requireAdmin } = require("../middleware/auth");

const { sendEmail } = require("../utils/mailer");
const buildCompanyRequestEmail = require("../utils/company-request-received");
const buildSeekerRequestEmail = require("../utils/seeker-request-received");

/* -------------------------------------------------------------------------- */
/*                               Rate Limiting                                */
/* -------------------------------------------------------------------------- */

// أقل وقت مسموح بين تقديم وآخر لنفس الإيميل / الهاتف / الجهاز (5 دقائق)
const MIN_INTERVAL_MS = 1000 * 60 * 5;

// أقصى عدد طلبات في اليوم لنفس الإيميل / الهاتف / الجهاز
const MAX_PER_DAY = 5;

/* -------------------------------------------------------------------------- */
/*                            Helpers: Sanitization                           */
/* -------------------------------------------------------------------------- */

function cleanString(value, maxLen = 200) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

function cleanMoney(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

function cleanEmail(value) {
  if (typeof value !== "string") return undefined;
  const v = value.trim().toLowerCase();
  if (!v) return undefined;
  return v.slice(0, 200);
}

function cleanPhone(value) {
  if (typeof value !== "string") return undefined;
  const digits = value.replace(/[^\d+]/g, "");
  if (!digits) return undefined;
  return digits.slice(0, 30);
}

function normalizeSalary(rawSalary) {
  if (!rawSalary || typeof rawSalary !== "object") return undefined;

  const allowedModes = ["hourly", "daily", "monthly", "yearly"];
  const mode =
    typeof rawSalary.mode === "string"
      ? rawSalary.mode.trim().toLowerCase()
      : "monthly";

  const normalized = {
    mode: allowedModes.includes(mode) ? mode : "monthly",
    min: cleanMoney(rawSalary.min),
    max: cleanMoney(rawSalary.max),
    currency:
      typeof rawSalary.currency === "string"
        ? rawSalary.currency.trim().toUpperCase().slice(0, 6)
        : "ILS",
  };

  if (
    normalized.min == null &&
    normalized.max == null &&
    normalized.mode === "monthly" &&
    normalized.currency === "ILS"
  ) {
    return undefined;
  }

  return normalized;
}

/* -------------------------------------------------------------------------- */
/*                            Pick + Normalize Body                           */
/* -------------------------------------------------------------------------- */

function pickLeadPayload(body = {}) {
  const payload = {};

  if (body.type === "seeker" || body.type === "company") {
    payload.type = body.type;
  }

  const name = cleanString(body.name, 150);
  if (name) payload.name = name;

  const phone = cleanPhone(body.phone);
  if (phone) payload.phone = phone;

  const email = cleanEmail(body.email);
  if (email) payload.email = email;

  const city = cleanString(body.city, 120);
  if (city) payload.city = city;

  const seeker_role = cleanString(body.seeker_role, 160);
  if (seeker_role) payload.seeker_role = seeker_role;

  const seeker_experience = cleanString(body.seeker_experience, 160);
  if (seeker_experience) payload.seeker_experience = seeker_experience;

  const seeker_notes = cleanString(body.seeker_notes, 1000);
  if (seeker_notes) payload.seeker_notes = seeker_notes;

  const company_name = cleanString(body.company_name, 160);
  if (company_name) payload.company_name = company_name;

  const job_title = cleanString(body.job_title, 160);
  if (job_title) payload.job_title = job_title;

  const job_type = cleanString(body.job_type, 160);
  if (job_type) payload.job_type = job_type;

  const company_notes = cleanString(body.company_notes, 1000);
  if (company_notes) payload.company_notes = company_notes;

  const salary = normalizeSalary(body.salary);
  if (salary) payload.salary = salary;

  return payload;
}

/* -------------------------------------------------------------------------- */
/*                             Validation Logic                               */
/* -------------------------------------------------------------------------- */

function validateLead(body = {}) {
  const errors = {};

  if (!body.type || !["seeker", "company"].includes(body.type)) {
    errors.type = "نوع الطلب غير صحيح";
  }

  if (!body.name || !String(body.name).trim()) {
    errors.name = "الاسم مطلوب";
  }

  if (!body.phone || !String(body.phone).trim()) {
    errors.phone = "رقم الهاتف مطلوب";
  }

  if (body.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      errors.email = "البريد الإلكتروني غير صالح";
    }
  }

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

  if (body.salary) {
    const s = body.salary;
    const allowedModes = ["hourly", "daily", "monthly", "yearly"];

    if (!s.mode || !allowedModes.includes(s.mode)) {
      errors.salary_mode = "طريقة تحديد الراتب غير صحيحة";
    }

    if (s.min != null && typeof s.min !== "number") {
      errors.salary_min = "الحد الأدنى للراتب يجب أن يكون رقمًا";
    }

    if (s.max != null && typeof s.max !== "number") {
      errors.salary_max = "الحد الأعلى للراتب يجب أن يكون رقمًا";
    }

    if (
      s.min != null &&
      s.max != null &&
      typeof s.min === "number" &&
      typeof s.max === "number" &&
      s.min > s.max
    ) {
      errors.salary_range =
        "الحد الأدنى للراتب لا يمكن أن يكون أكبر من الحد الأعلى";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/* -------------------------------------------------------------------------- */
/*                     Helper: Rate Limit Check (per source)                  */
/* -------------------------------------------------------------------------- */

async function checkRateLimit({ email, phone, ip, userAgent }) {
  const now = Date.now();
  const sinceInterval = new Date(now - MIN_INTERVAL_MS);
  const sinceDay = new Date(now - 1000 * 60 * 60 * 24);

  const orConditions = [];

  if (email) orConditions.push({ email });
  if (phone) orConditions.push({ phone });

  if (ip && userAgent) {
    orConditions.push({
      "meta.ip": ip,
      "meta.userAgent": userAgent,
    });
  }

  if (orConditions.length === 0) {
    return { allowed: true };
  }

  // 1) interval check
  const recentExists = await Lead.exists({
    createdAt: { $gte: sinceInterval },
    $or: orConditions,
  });

  if (recentExists) {
    return {
      allowed: false,
      reason: "interval",
    };
  }

  // 2) daily limit
  const dailyCount = await Lead.countDocuments({
    createdAt: { $gte: sinceDay },
    $or: orConditions,
  });

  if (dailyCount >= MAX_PER_DAY) {
    return {
      allowed: false,
      reason: "daily",
    };
  }

  return { allowed: true };
}


/* -------------------------------------------------------------------------- */
/*                    Helper: Async Email Notification (non-blocking)         */
/* -------------------------------------------------------------------------- */

// ⚡ إرسال الإيميل بالخلفية بعد ما نرجّع Response للمستخدم
function queueLeadEmails(doc) {
  // نفصل عن Mongoose Doc لو لزم
  const lead =
    doc && typeof doc.toObject === "function" ? doc.toObject() : doc;

  if (!lead || !lead.email) return;

  // نستخدم setImmediate عشان ما نبطئ الـ request الحالي
  setImmediate(async () => {
    try {
      if (lead.type === "company" && lead.email) {
        const html = buildCompanyRequestEmail({
          name: lead.name,
          company_name: lead.company_name,
          job_title: lead.job_title,
          city: lead.city,
        });

        await sendEmail({
          to: lead.email,
          subject: "تم استلام طلبكم لتوفير موظفين – منصة وظيفتك",
          html,
        });

        console.log("📧 Company confirmation email sent to:", lead.email);
      }

      if (lead.type === "seeker" && lead.email) {
        const html = buildSeekerRequestEmail({
          name: lead.name,
          seeker_role: lead.seeker_role,
          city: lead.city,
        });

        await sendEmail({
          to: lead.email,
          subject: "تم استلام طلبك – منصة وظيفتك",
          html,
        });

        console.log("📧 Seeker confirmation email sent to:", lead.email);
      }
    } catch (mailErr) {
      console.error("Error sending async lead email:", mailErr);
    }
  });
}

/* -------------------------------------------------------------------------- */
/*                            POST /api/leads                                 */
/* -------------------------------------------------------------------------- */

router.post("/", async (req, res) => {
  try {
    const rawBody =
      req.body && typeof req.body === "object" ? req.body : {};

    const payload = pickLeadPayload(rawBody);

    const { valid, errors } = validateLead(payload);
    if (!valid) {
      return res.status(400).json({
        ok: false,
        message: "في حقول ناقصة أو غير صحيحة",
        errors,
      });
    }

    const ip =
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      null;

    const userAgent =
      typeof req.headers["user-agent"] === "string"
        ? req.headers["user-agent"].slice(0, 300)
        : null;

    const referer =
      typeof req.headers.referer === "string"
        ? req.headers.referer.slice(0, 500)
        : null;

    const rate = await checkRateLimit({
      email: payload.email,
      phone: payload.phone,
      ip,
      userAgent,
    });

    if (!rate.allowed) {
      return res.status(429).json({
        ok: false,
        message:
          rate.reason === "daily"
            ? "قدمت عدد كبير من الطلبات اليوم. جرّب بكرة إن شاء الله."
            : "قدمت طلب قبل شوي. استنى شوية وقت وبعدين جرّب مرة ثانية.",
      });
    }

    const doc = new Lead({
      ...payload,
      meta: {
        ip,
        userAgent,
        referer,
      },
    });

    await doc.save();

    // ⚡ رجّع Response فورًا بدون انتظار الإيميل
    res.status(201).json({
      ok: true,
      message: "تم استلام الطلب بنجاح.",
      leadId: doc._id,
    });

    // ⚡ بعد ما نجاوب، نبعت الإيميل بالخلفية
    queueLeadEmails(doc);
  } catch (err) {
    console.error("Error creating lead:", err);
    return res.status(500).json({
      ok: false,
      message: "صار خطأ داخلي، جرّب كمان مرة لاحقًا.",
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                        Admin: List Leads with Filters                      */
/* -------------------------------------------------------------------------- */

router.get("/admin", auth, requireAdmin, async (req, res) => {
  try {
    let page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || 20;

    page = page < 1 ? 1 : page;
    limit = limit < 1 ? 1 : limit;
    limit = limit > 100 ? 100 : limit;

    const skip = (page - 1) * limit;

    const filter = {};

    if (
      typeof req.query.type === "string" &&
      ["seeker", "company"].includes(req.query.type)
    ) {
      filter.type = req.query.type;
    }

    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) {
        const fromDate = new Date(req.query.from);
        if (!isNaN(fromDate.getTime())) {
          filter.createdAt.$gte = fromDate;
        }
      }
      if (req.query.to) {
        const toDate = new Date(req.query.to);
        if (!isNaN(toDate.getTime())) {
          toDate.setHours(23, 59, 59, 999);
          filter.createdAt.$lte = toDate;
        }
      }
      if (Object.keys(filter.createdAt).length === 0) {
        delete filter.createdAt;
      }
    }

    if (req.query.city && String(req.query.city).trim()) {
      filter.city = String(req.query.city).trim();
    }

    const q = req.query.q && String(req.query.q).trim();
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");

      filter.$or = [
        { name: regex },
        { phone: regex },
        { email: regex },
        { city: regex },
        { seeker_role: regex },
        { seeker_experience: regex },
        { company_name: regex },
        { job_title: regex },
        { job_type: regex },
        { seeker_notes: regex },
        { company_notes: regex },
      ];
    }

    const allowedSortFields = {
      createdAt: "createdAt",
      name: "name",
      type: "type",
      city: "city",
    };

    const sortBy =
      (req.query.sortBy && allowedSortFields[req.query.sortBy]) ||
      "createdAt";
    const sortDir = req.query.sortDir === "asc" ? 1 : -1;

    const sort = { [sortBy]: sortDir };

    const [total, items] = await Promise.all([
      Lead.countDocuments(filter),
      Lead.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.json({
      ok: true,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        sortBy,
        sortDir: sortDir === 1 ? "asc" : "desc",
      },
      data: items,
    });
  } catch (err) {
    console.error("Error listing leads (admin):", err);
    return res.status(500).json({
      ok: false,
      message: "صار خطأ أثناء جلب الطلبات.",
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                          Admin: Get Single Lead                            */
/* -------------------------------------------------------------------------- */

router.get("/admin/:id", auth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const lead = await Lead.findById(id).lean();
    if (!lead) {
      return res.status(404).json({
        ok: false,
        message: "الطلب غير موجود.",
      });
    }

    return res.json({
      ok: true,
      data: lead,
    });
  } catch (err) {
    console.error("Error fetching lead (admin):", err);
    return res.status(500).json({
      ok: false,
      message: "صار خطأ أثناء جلب بيانات الطلب.",
    });
  }
});

/* -------------------------------------------------------------------------- */
/*                           Admin: Leads Statistics                          */
/* -------------------------------------------------------------------------- */

router.get("/admin/stats", auth, requireAdmin, async (req, res) => {
  try {
    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [total, today, byType, last7Days] = await Promise.all([
      Lead.countDocuments({}),
      Lead.countDocuments({
        createdAt: { $gte: startOfToday },
      }),
      Lead.aggregate([
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 },
          },
        },
      ]),
      Lead.aggregate([
        {
          $match: {
            createdAt: { $gte: sevenDaysAgo },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return res.json({
      ok: true,
      data: {
        total,
        today,
        byType: byType.map((x) => ({
          type: x._id || "unknown",
          count: x.count,
        })),
          last7Days: last7Days.map((x) => ({
            date: x._id,
            count: x.count,
          })),
      },
    });
  } catch (err) {
    console.error("Error fetching leads stats (admin):", err);
    return res.status(500).json({
      ok: false,
      message: "صار خطأ أثناء جلب الإحصائيات.",
    });
  }
});

module.exports = router;
