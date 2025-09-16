// controllers/applicationController.js
const Application = require('../models/Application');
const Job = require('../models/Job');
const File = require('../models/File'); // ← لقراءة mimeType/size عند الحاجة
const Company = require('../models/Company'); // ← تحقق الملكية للشركة
const { ok, created, noContent } = require('../utils/responses');
const { logAudit } = require('../utils/audit');
const jobCtrl = require('./jobController');

/** الحالات المسموحة لحالة الطلب */
const ALLOWED_APP_STATUSES = new Set([
  'pending', 'reviewed', 'interview', 'accepted', 'rejected'
]);

/** رابط تنزيل آمن موحّد */
const buildDownloadUrl = (id) => (id ? `/api/files/${id}/download` : null);

/** تطبيع تمثيل السيرة الذاتية من وثيقة الطلب + (اختياري) وثيقة الملف عند populate */
function normalizeCv(a) {
  // لو cvFileId عبارة عن كائن (populate) استخرج _id
  const fileDoc = a && a.cvFileId && typeof a.cvFileId === 'object' ? a.cvFileId : null;
  const fileId  = fileDoc ? (fileDoc._id || fileDoc.id) : a.cvFileId;

  // ملف مرفوع
  if (fileId) {
    return {
      kind: 'file',
      fileId: String(fileId),
      url: null,
      originalName: a.cvName || fileDoc?.originalName || 'CV',
      mime: a.cvMime || fileDoc?.mimeType || null,
      size: (typeof a.cvSize === 'number' ? a.cvSize
            : (typeof fileDoc?.size === 'number' ? fileDoc.size : null)),
      downloadUrl: buildDownloadUrl(String(fileId))
    };
  }

  // رابط خارجي
  if (a.cvUrl) {
    return {
      kind: 'url',
      fileId: null,
      url: a.cvUrl,
      originalName: a.cvName || 'CV',
      mime: a.cvMime || null,
      size: (typeof a.cvSize === 'number' ? a.cvSize : null),
      downloadUrl: a.cvUrl
    };
  }

  return null;
}

/** إثراء ميتاداتا CV من وثيقة File (والتحقق من الملكية) */
async function enrichCvFromFile({ cvFileId, userId, current = {} }) {
  if (!cvFileId) return current;

  const file = await File.findById(cvFileId)
    .select('ownerId scope originalName mimeType size visibility')
    .lean();
  if (!file) {
    const err = Object.assign(new Error('الملف غير موجود'), { status: 404 });
    throw err;
  }
  if (String(file.ownerId) !== String(userId)) {
    const err = Object.assign(new Error('غير مصرح بإرفاق هذا الملف'), { status: 403 });
    throw err;
  }
  // لو أردت فرض scope === 'cv' فعّل التالي:
  // if (file.scope !== 'cv') {
  //   const err = Object.assign(new Error('نوع الملف غير مناسب للسيرة الذاتية'), { status: 422 });
  //   throw err;
  // }

  return {
    cvName: current.cvName || file.originalName || 'CV',
    cvMime: current.cvMime || file.mimeType || undefined,
    cvSize: (typeof current.cvSize === 'number' ? current.cvSize
            : (typeof file.size === 'number' ? file.size : undefined)),
    cvFileId,
    _fileDoc: file,
  };
}

/** تحقق ملكية الشركة للوظيفة بالنسبة للمستخدم الحالي (شركة أو أدمن) */
async function assertCompanyOwnsJobOrAdmin(req, jobId) {
  const job = await Job.findById(jobId).select('companyId').lean();
  if (!job) {
    const err = Object.assign(new Error('الوظيفة غير موجودة'), { status: 404 });
    throw err;
  }
  if (req.auth?.role === 'admin') return job;

  // المالك: صاحب الشركة
  const company = await Company.findOne({ _id: job.companyId, ownerId: req.auth.id }).select('_id').lean();
  if (!company) {
    const err = Object.assign(new Error('غير مصرح بعرض بيانات هذه الوظيفة'), { status: 403 });
    throw err;
  }
  return job;
}

/* =========================================================
 * POST /api/applications — إنشاء طلب تقديم
 * ========================================================= */
exports.apply = async (req, res) => {
  const { jobId, message, cvFileId, cvUrl } = req.body;
  let   { cvName, cvMime, cvSize } = req.body;

  const job = await Job.findById(jobId).select('_id companyId status archived');
  if (!job || job.archived || job.status !== 'open') {
    return res.status(400).json({ message: 'لا يمكن التقديم على هذه الوظيفة' });
  }

  if (cvFileId && cvUrl) {
    return res.status(400).json({ message: 'أرسل إمّا ملف السيرة الذاتية أو رابطًا، وليس الاثنين' });
  }

  try {
    // تجهيز بيانات CV
    if (cvFileId) {
      const enriched = await enrichCvFromFile({
        cvFileId,
        userId: req.auth.id,
        current: { cvName, cvMime, cvSize }
      });
      cvName = enriched.cvName;
      cvMime = enriched.cvMime;
      cvSize = enriched.cvSize;
    } else if (cvUrl) {
      cvName = cvName || 'CV';
    }

    // إنشاء طلب التقديم
    const app = await Application.create({
      jobId: job._id,
      userId: req.auth.id,
      companyId: job.companyId,
      message: message?.trim(),
      cvFileId: cvFileId || undefined,
      cvUrl: (!cvFileId ? (cvUrl || undefined) : undefined),
      cvName: cvName || undefined,
      cvMime: cvMime || undefined,
      cvSize: (typeof cvSize === 'number' ? cvSize : undefined),
      status: 'pending'
    });

    // ربط الملف بالطلب (غير حرج)
    if (cvFileId) {
      File.updateOne(
        { _id: cvFileId },
        { $set: { 'linkTo.model': 'Application', 'linkTo.id': app._id } }
      ).catch(() => {});
    }

    // تسجيل في الـ Audit log
    await logAudit(req, {
      action: 'apply_job',
      target: { model: 'Application', id: app._id },
      meta: { jobId: job._id },
    });

    // ⚡ هنا فقط نزيد عدد المتقدمين بعد نجاح إنشاء الطلب
    await jobCtrl.incrementApplicants(job._id);

    const response = {
      _id: app._id,
      jobId: app.jobId,
      userId: app.userId,
      companyId: app.companyId,
      message: app.message || '',
      status: app.status,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      cv: normalizeCv(app)
    };

    return created(res, { application: response });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ message: 'لقد قدّمت على هذه الوظيفة سابقًا' });
    }
    if (err?.status) {
      return res.status(err.status).json({ message: err.message });
    }
    throw err;
  }
};


exports.checkMineForJob = async (req, res) => {
  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ message: 'jobId مطلوب' });
  }

  // نبحث عن طلب واحد لنفس (jobId + userId)
  const app = await Application.findOne({ jobId, userId: req.auth.id })
    .select('_id jobId userId status createdAt cvFileId cvUrl cvName cvMime cvSize')
    // (اختياري) لو تحب إثراء الاسم/الحجم من ملف الـCV مباشرة:
    .populate([{ path: 'cvFileId', select: 'originalName mimeType size' }])
    .lean();

  return ok(res, {
    applied: !!app,
    application: app
      ? {
          id: String(app._id),
          _id: app._id,           // توافق رجعي
          jobId: app.jobId,
          userId: app.userId,
          status: app.status,
          createdAt: app.createdAt,
          cv: normalizeCv(app),   // سيبني downloadUrl إن كان ملف
        }
      : null,
  });
};
/* =========================================================
 * GET /api/applications/me — طلباتي (باحث)
 * يرجّع { items, meta }
 * ========================================================= */
exports.myApplications = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const skip  = (page - 1) * limit;

    const baseQuery = { userId: req.auth.id };

    const [items, total] = await Promise.all([
      Application.find(baseQuery)
        .select('jobId companyId status createdAt message cvFileId cvUrl cvName cvMime cvSize')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate([
          { path: 'jobId', select: 'title city companyId', populate: { path: 'companyId', select: 'name' } },
          { path: 'companyId', select: 'name' },
          { path: 'cvFileId', select: 'originalName mimeType size url path visibility scope' },
        ])
        .lean(),
      Application.countDocuments(baseQuery),
    ]);

    const dataItems = items.map((a) => {
      const job = a.jobId || {};
      const company = a.companyId || job.companyId || {};
      return {
        _id: a._id,
        status: a.status,
        createdAt: a.createdAt,
        jobId: job?._id || a.jobId,
        companyId: company?._id || a.companyId,
        job: job ? { _id: job._id, title: job.title || '', city: job.city || '' } : null,
        company: company ? { _id: company._id, name: company.name || '' } : null,
        cv: normalizeCv(a),
        message: a.message || '',
      };
    });

    return res.json({
      message: 'OK',
      data: {
        items: dataItems,
        meta: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    next(err);
  }
};

/* =========================================================
 * GET /api/applications?jobId=&page=&limit= — متقدمو وظيفة (شركة/أدمن)
 * يرجّع { items, meta }
 * ========================================================= */
exports.listByJob = async (req, res, next) => {
  try {
    const { jobId } = req.query;
    if (!jobId) return res.status(400).json({ message: 'jobId مطلوب' });

    // تحقق ملكية الشركة أو أدمن
    await assertCompanyOwnsJobOrAdmin(req, jobId);

    const page  = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const skip  = (page - 1) * limit;

    const query = { jobId };

    const [items, total] = await Promise.all([
      Application.find(query)
        .select('userId status createdAt message cvFileId cvUrl cvName cvMime cvSize')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate([
          { path: 'userId', select: 'name email phone' },
          { path: 'cvFileId', select: 'originalName mimeType size url path visibility scope' },
        ])
        .lean(),
      Application.countDocuments(query),
    ]);

    const flat = items.map((a) => ({
      _id: a._id,
      user: a.userId
        ? { _id: a.userId._id, name: a.userId.name, email: a.userId.email, phone: a.userId.phone || '' }
        : null,
      status: a.status,
      createdAt: a.createdAt,
      cv: normalizeCv(a),
      message: a.message || '',
    }));

    return res.json({
      message: 'OK',
      data: {
        items: flat,
        meta: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    next(err);
  }
};

/* =========================================================
 * PATCH /api/applications/:id/status — تحديث حالة الطلب
 * ========================================================= */
exports.setStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!ALLOWED_APP_STATUSES.has(status)) {
    return res.status(422).json({ message: 'status غير صالح' });
  }

  // تحقق ملكية الشركة أو أدمن
  const app = await Application.findById(id).select('jobId status');
  if (!app) return res.status(404).json({ message: 'الطلب غير موجود' });
  await assertCompanyOwnsJobOrAdmin(req, app.jobId);

  const updated = await Application.findByIdAndUpdate(
    id,
    { $set: { status } },
    { new: true }
  );

  await logAudit(req, {
    action: 'update_application_status',
    target: { model: 'Application', id: updated._id },
    meta: { status: updated.status },
  });

  return ok(res, { application: updated });
};

/* =========================================================
 * DELETE /api/applications/:id — حذف طلبي (لصاحب الطلب)
 * ========================================================= */
exports.remove = async (req, res) => {
  const app = await Application.findOneAndDelete({
    _id: req.params.id,
    userId: req.auth.id,
  });
  if (app) {
    await logAudit(req, {
      action: 'delete_application',
      target: { model: 'Application', id: app._id },
    });
  }
  return noContent(res);
};
