const Company = require('../models/Company');
const Job = require('../models/Job');
const { ok, created, withPagination } = require('../utils/responses');
const { parsePagination, paginateModel } = require('../utils/pagination');
const { logAudit } = require('../utils/audit');
const Application = require('../models/Application');

exports.create = async (req, res) => {
  const doc = await Company.create({ ...req.body, ownerId: req.auth.id });
  await Company.ensureSlug(doc);
  await doc.save();
  await logAudit(req, { action: 'create_company', target: { model: 'Company', id: doc._id } });
  return created(res, { company: doc });
};

exports.getById = async (req, res) => {
  const company = await Company.findById(req.params.id);
  return ok(res, { company });
};

exports.getMine = async (req, res) => {
  const company = await Company.findOne({ ownerId: req.auth.id });
  return ok(res, { company });
};

exports.update = async (req, res) => {
  const allowed = ['name','slug','city','citySlug','address','about','logoUrl','coverUrl','contactEmail','contactPhone','website','socials','applicationChannel','applicationTarget','status'];
  const set = {}; for (const k of allowed) if (k in req.body) set[k] = req.body[k];
  const doc = await Company.findByIdAndUpdate(req.params.id, { $set: set }, { new: true });
  await logAudit(req, { action: 'update_company', target: { model: 'Company', id: doc._id } });
  return ok(res, { company: doc });
};

// Admin: verify/unverify company
exports.setVerified = async (req, res) => {
  const { id } = req.params;
  const { verified } = req.body;
  const patch = { verified: !!verified, verifiedAt: verified ? new Date() : null, verifiedBy: verified ? req.auth.id : null };
  const company = await Company.findByIdAndUpdate(id, { $set: patch }, { new: true });
  await logAudit(req, { action: verified ? 'verify_company' : 'unverify_company', target: { model: 'Company', id } });
  return ok(res, { company });
};

// Public: list companies (optional filters)
// controllers/companyController.js
// controllers/companyController.js
exports.list = async (req, res) => {
  const page = parsePagination(req.query);
  const filter = {};

  if (req.query.city) filter.city = req.query.city;

  // ✅ لا تتجاهل verified=false (تمييز "موجود لكنه false" عن "غير مرسَل")
  if (Object.prototype.hasOwnProperty.call(req.query, 'verified')) {
    filter.verified = !!req.query.verified;
  }

  // ✅ دعم q بالاسم/المدينة/السلَج
  if (req.query.q && req.query.q.trim()) {
    const esc = req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(esc, 'i');
    filter.$or = [{ name: rx }, { city: rx }, { slug: rx }];
  }

  const result = await paginateModel(Company, filter, page);
  return withPagination(res, result);
};



// controllers/companyController.js
exports.stats = async (req, res) => {
  const companyId = req.params.id;

  const jobs = await Job
    .find({ companyId })
    .select('_id title city status archived createdAt')
    .sort({ createdAt: -1 })
    .lean();

  const jobIds = jobs.map(j => j._id);
  const activeJobs = jobs.filter(j => j.status === 'open' && !j.archived).length;

  if (jobIds.length === 0) {
    // ارجع الشكل المسطّح المطلوب من الواجهة
    return ok(res, {
      activeJobs: 0,
      applicantsToday: 0,
      applicantsWeek: 0,
      totalApplicants: 0,
      latestJobs: []
    });
  }

  const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
  const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - 7);

  const baseFilter = { jobId: { $in: jobIds } };

  const [ totalApplicants, applicantsToday, applicantsWeek ] = await Promise.all([
    Application.countDocuments(baseFilter),
    Application.countDocuments({ ...baseFilter, createdAt: { $gte: startOfToday } }),
    Application.countDocuments({ ...baseFilter, createdAt: { $gte: startOfWeek } }),
  ]);

  const latestJobs = jobs.slice(0, 5).map(j => ({ _id: j._id, title: j.title, city: j.city }));

  await Company.findByIdAndUpdate(companyId, { $set: { activeJobsCount: activeJobs } }, { new: false });

  // 👈 مخرجات مسطّحة يستخدمها الـ UI مباشرة
  return ok(res, {
    activeJobs,
    applicantsToday,
    applicantsWeek,
    totalApplicants,
    latestJobs
  });
};


// === Company Jobs ===
// controllers/companyController.js
exports.listCompanyJobs = async (req, res) => {
  const { id: companyId } = req.params;
  const page = parsePagination(req.query);
  const { q, city, jobTypeSlug, seniority } = req.query;

  const csv = (v) =>
    String(v)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

  const fieldIn = req.query.fieldSlugs ? csv(req.query.fieldSlugs) : null;
  const skillIn = req.query.skillSlugs ? csv(req.query.skillSlugs) : null;

  // هل المستخدم مالك/أدمن؟
  let canSeeAll = false;
  if (req.auth) {
    if (req.auth.role === 'admin') {
      canSeeAll = true;
    } else if (req.auth.role === 'company') {
      const owns = await Company.exists({ _id: companyId, ownerId: req.auth.id });
      if (owns) canSeeAll = true;
    }
  }

  // فلتر أساسي
  const filter = { companyId };

  // قيود الرؤية العامة
  if (!canSeeAll) {
    filter.archived = false;
    filter.status = 'open';
    filter.isApproved = true;
  }

  // فلاتر اختيارية
  if (city) filter.city = city;
  if (jobTypeSlug) filter.jobTypeSlug = jobTypeSlug;
  if (seniority) filter.seniority = seniority;

  if (req.query.fieldSlug) filter.fieldSlugs = req.query.fieldSlug;
  if (req.query.skillSlug) filter.skillSlugs = req.query.skillSlug;

  if (fieldIn && fieldIn.length) filter.fieldSlugs = { $in: fieldIn };
  if (skillIn && skillIn.length) filter.skillSlugs = { $in: skillIn }; // ✅ تصحيح هنا

  // بحث نصي
  if (q && q.trim()) {
    const esc = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(esc, 'i');
    filter.$or = [{ title: rx }, { description: rx }];
  }

  // تحكم إضافي للمالك/الأدمن
  if (canSeeAll) {
    if (Object.prototype.hasOwnProperty.call(req.query, 'archived')) {
      filter.archived = toBool(req.query.archived);
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (Object.prototype.hasOwnProperty.call(req.query, 'isApproved')) {
      filter.isApproved = toBool(req.query.isApproved);
    }
  }

  // الفرز
  const sortBy = req.query.sortBy || 'createdAt';
  const sortDir = (req.query.sortDir || 'desc').toLowerCase() === 'asc' ? 1 : -1;
  const sort = { [sortBy]: sortDir, _id: -1 };

  // ====== projection: دعم fields من الكلاينت + افتراضي يتضمن المقاييس ======
  // allowlist لتأمين الحقول
  const ALLOW = new Set([
    '_id', 'title', 'city', 'slug', 'createdAt',
    'isFeatured', 'jobTypeSlug', 'seniority',
    'fieldSlugs', 'skillSlugs', 'status', 'isApproved', 'archived',
    'applicantsCount', 'viewsCount', // 👈 المقاييس المطلوبة
    // أضف حقولًا أخرى لو احتجتها
  ]);

  // افتراضي آمن
  const DEFAULT_FIELDS = [
    '_id', 'title', 'city', 'slug', 'createdAt',
    'isFeatured', 'jobTypeSlug', 'seniority',
    'fieldSlugs', 'skillSlugs', 'status', 'isApproved', 'archived',
    'applicantsCount', 'viewsCount', // 👈 أهم سطرين
  ];

  let projectionFields = DEFAULT_FIELDS;

  if (req.query.fields && String(req.query.fields).trim()) {
    const reqFields = String(req.query.fields)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((f) => ALLOW.has(f));

    if (reqFields.length) {
      // تأكد من وجود الحدّ الأدنى دائمًا
      const MIN = ['_id', 'title', 'createdAt'];
      const set = new Set([...reqFields, ...MIN]);

      // لو المستخدم فرز على حقل غير موجود ضمن projection، أضِفه (اختياري)
      if (ALLOW.has(sortBy)) set.add(sortBy);

      projectionFields = Array.from(set);
    }
  }

  const projection = projectionFields.join(' ');

  const skip = (page.page - 1) * page.limit;

  const [jobs, total] = await Promise.all([
    Job.find(filter).select(projection).sort(sort).skip(skip).limit(page.limit).lean(),
    Job.countDocuments(filter),
  ]);

  const wantFlat =
    (req.query.flat && toBool(req.query.flat)) ||
    (req.query.shape && String(req.query.shape).toLowerCase() === 'array');

  if (wantFlat) {
    // سيصبح الرد { message, data: [...] } عبر util ok()
    return ok(res, jobs);
  }

  return res.status(200).json({
    message: 'تم',
    meta: {
      total,
      page: page.page,
      limit: page.limit,
      pages: Math.ceil(total / page.limit),
      hasNext: page.page * page.limit < total,
      hasPrev: page.page > 1,
    },
    data: jobs,
  });
};

// الشركة الحالية (مالك الشركة فقط)
exports.listMyJobs = async (req, res) => {
  // يتطلب middlewares: auth + requireRole('company')
  const company = await Company.findOne({ ownerId: req.auth.id }).select('_id');
  if (!company) {
    return res.status(200).json({
      message: 'تم',
      meta: { total: 0, page: 1, limit: 20, pages: 0, hasNext: false, hasPrev: false },
      data: [],
    });
  }

  // أعد استخدام نفس المنطق لكن باعتبار أنه المالك => canSeeAll=true
  req.params.id = String(company._id);
  return exports.listCompanyJobs(req, res);
};
