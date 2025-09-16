// controllers/jobController.js
const Job = require('../models/Job');
const Company = require('../models/Company');
const { ok, withPagination, created } = require('../utils/responses');
const { parsePagination } = require('../utils/pagination');

function csvToArray(v) {
  return String(v)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}


// controllers/jobController.js
exports.list = async (req, res) => {
  try {
    const page = parsePagination(req.query); // { page, limit }

    // فلتر افتراضي
    const filter = {
      archived: false,
      status: "open",
      isApproved: true,
    };

    // فلاتر أساسية
    if (req.query.companyId) filter.companyId = req.query.companyId;
    if (req.query.city) filter.city = req.query.city;
    if (req.query.jobTypeSlug) filter.jobTypeSlug = req.query.jobTypeSlug;
    if (req.query.seniority) filter.seniority = req.query.seniority;

    if (req.query.fieldSlugs) {
      const arr = csvToArray(req.query.fieldSlugs);
      if (arr.length) filter.fieldSlugs = { $in: arr };
    }
    if (req.query.skillSlugs) {
      const arr = csvToArray(req.query.skillSlugs);
      if (arr.length) filter.skillSlugs = { $in: arr };
    }

    // ترتيب
    const allowedSort = ["createdAt", "isFeatured", "viewsCount", "applicantsCount"];
    const dir = req.query.dir === "asc" ? 1 : -1;
    const sort = {};
    if (allowedSort.includes(req.query.sort)) sort[req.query.sort] = dir;
    else sort.createdAt = -1;

    const companiesColl = Company.collection.name;
    const skip = (page.page - 1) * page.limit;

    // ✅ بايبلاين
    const pipeline = [
      { $match: filter },

      // ربط الشركة
      {
        $lookup: {
          from: companiesColl,
          localField: "companyId",
          foreignField: "_id",
          as: "company",
        },
      },
      { $unwind: { path: "$company", preserveNullAndEmptyArrays: true } },

      // 🔍 البحث النصي الحر (title + description + city + company.name)
      ...(req.query.q
        ? [
            {
              $match: {
                $or: [
                  { title: { $regex: req.query.q, $options: "i" } },
                  { description: { $regex: req.query.q, $options: "i" } },
                  { city: { $regex: req.query.q, $options: "i" } },
                  { "company.name": { $regex: req.query.q, $options: "i" } },
                ],
              },
            },
          ]
        : []),

      { $sort: sort },

      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: page.limit },
            {
              $project: {
                title: 1,
                description: 1,
                city: 1,
                address: 1,
                jobTypeSlug: 1,
                seniority: 1,
                fieldSlugs: 1,
                skillSlugs: 1,
                status: 1,
                isApproved: 1,
                archived: 1,
                isFeatured: 1,
                createdAt: 1,
                updatedAt: 1,
                viewsCount: 1,
                applicantsCount: 1,
                companyId: 1,
                company: {
                  _id: "$company._id",
                  name: "$company.name",
                  slug: "$company.slug",
                  logo: "$company.logo",
                },
              },
            },
          ],
          total: [{ $count: "count" }],
        },
      },
    ];

    const agg = await Job.aggregate(pipeline);
    const items = agg?.[0]?.items ?? [];
    const total = agg?.[0]?.total?.[0]?.count ?? 0;

    return withPagination(res, {
      items,
      total,
      page: page.page,
      limit: page.limit,
    });
  } catch (err) {
    console.error("Jobs.list error:", err);
    return res.status(500).json({ message: "حدث خطأ أثناء جلب الوظائف" });
  }
};


exports.list2 = async (req, res) => {
  const page = parsePagination(req.query); // { page, limit }
const filter = {};  
const sort = {};
  // فلاتر أساسية
  if (req.query.companyId) filter.companyId = req.query.companyId;
  if (req.query.city) filter.city = req.query.city;
  if (req.query.jobTypeSlug) filter.jobTypeSlug = req.query.jobTypeSlug;
  if (req.query.seniority) filter.seniority = req.query.seniority;
  if (req.query.fieldSlug) filter.fieldSlugs = req.query.fieldSlug;
  if (req.query.skillSlug) filter.skillSlugs = req.query.skillSlug;

  // دعم CSV للفلاتر المتعدّدة
  if (req.query.fieldSlugs) {
    const arr = String(req.query.fieldSlugs).split(',').map(s => s.trim()).filter(Boolean);
    if (arr.length) filter.fieldSlugs = { $in: arr };
  }
  if (req.query.skillSlugs) {
    const arr = String(req.query.skillSlugs).split(',').map(s => s.trim()).filter(Boolean);
    if (arr.length) filter.skillSlugs = { $in: arr };
  }

  // نص حر
  if (req.query.q) filter.$text = { $search: req.query.q };

  // تفسير status
  if (req.query.status) {
    const s = req.query.status;
    if (s === 'open' || s === 'closed') {
      filter.status = s;
    } else if (s === 'archived') {
      filter.archived = true;
    } else if (s === 'active') {
      filter.status = 'open';
      filter.archived = { $ne: true };
    } else if (s === 'pending' || s === 'draft') {
      // توافق رجعي: لا يوجد draft في الـ schema — نعتبرها وظائف غير معتمدة
      filter.isApproved = false;
    }
  }

  // ترتيب
  const allowedSort = ['createdAt','isFeatured','viewsCount','applicantsCount'];
  const dir = req.query.dir === 'asc' ? 1 : -1;
  if (allowedSort.includes(req.query.sort)) sort[req.query.sort] = dir;
  else sort.createdAt = -1;

  // ترقيم
  const skip = (page.page - 1) * page.limit;
  const [items, total] = await Promise.all([
    Job.find(filter).sort(sort).skip(skip).limit(page.limit).lean(),
    Job.countDocuments(filter),
  ]);

  return withPagination(res, { items, total, page: page.page, limit: page.limit });
};


exports.count = async (req, res, next) => {
  try {
    const count = await Job.countDocuments({
      archived: false,
      status: 'open',
      isApproved: true,
    });
    return ok(res, { jobsCount: count });
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await Job.findByIdAndUpdate(
      id,
      { $inc: { viewsCount: 1 } },
      { new: true }
    )
      .populate({
        path: "companyId",            
        select: "name slug logo about", // ✅ أضفنا about
      })
      .lean();

    if (!job) {
      return res.status(404).json({ message: "الوظيفة غير موجودة" });
    }

    // توحيد: نرجع company ككائن مستقل
    const normalizedJob = {
      ...job,
      company: job.companyId
        ? {
            _id: job.companyId._id,
            name: job.companyId.name,
            slug: job.companyId.slug,
            logo: job.companyId.logo,
            about: job.companyId.about, // ✅ نرجع about
          }
        : null,
    };
    delete normalizedJob.companyId; // لو مش محتاج الـ id المرجعي

    return res.json({ job: normalizedJob });
  } catch (err) {
    console.error("getById error:", err);
    return res.status(500).json({ message: "حدث خطأ أثناء جلب الوظيفة" });
  }
};


exports.create = async (req, res) => {
  // استنتاج الشركة المملوكة للمستخدم الحالي
  const owned = await Company.findOne({ ownerId: req.auth.id }).select('_id');
  if (!owned) return res.status(403).json({ message: 'لا توجد شركة مرتبطة بالحساب' });

  // ملاحظة: city مطلوبة حسب الراوتر والـ schema
  const payload = {
    companyId:   owned._id,
    title:       req.body.title,
    description: req.body.description,
    city:        req.body.city,
    jobTypeSlug: req.body.jobTypeSlug,
    seniority:   req.body.seniority,
    type:        req.body.type,
    tags:        Array.isArray(req.body.tags) ? req.body.tags : undefined,
    fieldSlugs:  Array.isArray(req.body.fieldSlugs) ? req.body.fieldSlugs : undefined,
    skillSlugs:  Array.isArray(req.body.skillSlugs) ? req.body.skillSlugs : undefined,
    applyMethod: req.body.applyMethod,
    applyTarget: req.body.applyTarget,
  };

  const doc = await Job.create(payload);
  return created(res, { job: doc });
};

exports.update = async (req, res) => {
  const allowed = [
    'title','description','city','jobTypeSlug','seniority','type',
    'tags','fieldSlugs','skillSlugs',
    'applyMethod','applyTarget',
    'archived','status','isApproved','isFeatured'
  ];
  const set = {};
  for (const k of allowed) if (k in req.body) set[k] = req.body[k];

  const doc = await Job.findByIdAndUpdate(req.params.id, { $set: set }, { new: true });
  return ok(res, { job: doc });
};

exports.setStatus = async (req, res) => {
  const doc = await Job.findByIdAndUpdate(
    req.params.id,
    { $set: { status: req.body.status } },
    { new: true }
  );
  return ok(res, { job: doc });
};

exports.remove = async (req, res) => {
  // إن كانت الوظيفة محذوفة وهي نشطة (open && !archived)، عدّل عدّاد الشركة يدويًا
  const job = await Job.findById(req.params.id).select('companyId status archived');
  if (!job) return ok(res, { removed: false });

  const wasActive = job.status === 'open' && !job.archived;
  await Job.deleteOne({ _id: job._id });
  if (wasActive) {
    await Company.updateOne({ _id: job.companyId }, { $inc: { activeJobsCount: -1 } });
  }
  return ok(res, { removed: true });
};


exports.incrementViews = async (req, res) => {
  try {
    const { id } = req.params; // jobId
    const job = await Job.findByIdAndUpdate(
      id,
      { $inc: { viewsCount: 1 } },
      { new: true, lean: true }
    );
    if (!job) return res.status(404).json({ message: 'الوظيفة غير موجودة' });
    res.json({ viewsCount: job.viewsCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في زيادة المشاهدات' });
  }
};

/** زيادة عدد المتقدمين */
exports.incrementApplicants = async (jobId) => {
  try {
    await Job.findByIdAndUpdate(jobId, { $inc: { applicantsCount: 1 } });
  } catch (err) {
    console.error("خطأ في تحديث عدد المتقدمين:", err);
  }
};