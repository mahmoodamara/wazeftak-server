// controllers/savedController.js
const mongoose = require('mongoose');
const SavedJob = require('../models/SavedJob');
const Job = require('../models/Job');
const { ok, created, noContent, withPagination, badRequest, notFound, serverError } = require('../utils/responses');
const { parsePagination, paginateModel } = require('../utils/pagination');

/**
 * احفظ وظيفة (Idempotent)
 * POST /api/saved-jobs
 */
exports.save = async (req, res) => {
  try {
    const userId = req.auth?.id;
    const { jobId } = req.body;

    if (!userId) return badRequest(res, 'المستخدم غير مُعرف');
    if (!jobId) return badRequest(res, 'معرف الوظيفة مطلوب');
    if (!mongoose.Types.ObjectId.isValid(jobId)) return badRequest(res, 'معرف الوظيفة غير صحيح');

    const job = await Job.findOne({
      _id: jobId, archived: { $ne: true }, status: 'open', isApproved: true
    }).select('_id').lean();

    if (!job) return notFound(res, 'الوظيفة غير متاحة للحفظ');

    // حد أقصى
    const savedCount = await SavedJob.countDocuments({ userId });
    const MAX_SAVED_JOBS = Number(process.env.MAX_SAVED_JOBS || 100);
    if (savedCount >= MAX_SAVED_JOBS) {
      const exists = await SavedJob.exists({ userId, jobId });
      if (!exists) return badRequest(res, `لا يمكن حفظ أكثر من ${MAX_SAVED_JOBS} وظيفة`);
    }

    // upsert
    const now = new Date();
    await SavedJob.updateOne(
      { userId, jobId },
      { $setOnInsert: { userId, jobId, createdAt: now } },
      { upsert: true }
    );

    // ✅ شكل موحّد يفهمه الفرونت بسهولة
    return ok(res, { saved: true, jobId, savedAt: now });

  } catch (error) {
    console.error('❌ خطأ في حفظ الوظيفة:', error);
    return serverError(res, 'حدث خطأ في حفظ الوظيفة');
  }
};

/**
 * أزل الحفظ (Idempotent)
 * DELETE /api/saved-jobs/:jobId
 */
exports.unsave = async (req, res) => {
  try {
    const userId = req.auth?.id;
    const { jobId } = req.params;

    if (!userId) return badRequest(res, 'المستخدم غير مُعرف');
    if (!jobId) return badRequest(res, 'معرف الوظيفة مطلوب');
    if (!mongoose.Types.ObjectId.isValid(jobId)) return badRequest(res, 'معرف الوظيفة غير صحيح');

    const result = await SavedJob.findOneAndDelete({ userId, jobId }).lean();

    // ✅ ثبّت نفس الشكل وأضف removed كمعلومة إضافية
    return ok(res, { saved: false, jobId, removed: !!result });

  } catch (error) {
    console.error('❌ خطأ في حذف الوظيفة المحفوظة:', error);
    return serverError(res, 'حدث خطأ في حذف الوظيفة');
  }
};
/**
 * قائمة المحفوظات
 * GET /api/saved-jobs
 */
/**
 * قائمة المحفوظات
 * GET /api/saved-jobs
 */
exports.list = async (req, res) => {
  try {
    const userId = req.auth?.id;
    if (!userId) return badRequest(res, 'المستخدم غير مُعرف');

    const page = parsePagination(req.query, { maxLimit: 50, defaultLimit: 20 });

    // ترتيب (افتراضي: الأحدث حفظًا)
    const sort = req.query.sort || '-createdAt';
    const sortObj = {};
    if (sort?.startsWith('-')) sortObj[sort.slice(1)] = -1;
    else sortObj[sort] = 1;

    const jobSelect = [
      'title', 'companyId', 'city', 'salaryMin', 'salaryMax',
      'currency', 'seniority', 'createdAt', 'jobType',
      'description', 'viewsCount', 'applicantsCount', 'isFeatured'
    ].join(' ');

    const raw = await paginateModel(
      SavedJob,
      { userId: new mongoose.Types.ObjectId(userId) },
      page,
      'jobId createdAt', // projection على SavedJob
      [{
        path: 'jobId',
        match: { archived: { $ne: true }, status: 'open', isApproved: true },
        select: jobSelect,
        populate: { path: 'companyId', select: 'name logo', options: { lean: true } },
        options: { lean: true }
      }],
      { lean: true, sort: sortObj }
    );

    // 🔒 استخرج المصفوفة بغضّ النظر عن الشكل
    const rows = Array.isArray(raw?.docs) ? raw.docs
               : Array.isArray(raw?.items) ? raw.items
               : Array.isArray(raw?.data?.docs) ? raw.data.docs
               : [];

    // ⛏️ شكّل العناصر النهائية
    const mapped = rows
      .filter(doc => doc && doc.jobId) // إزالة الوظائف المحذوفة/غير المتاحة
      .map(doc => ({
        id: doc._id,
        savedAt: doc.createdAt,
        job: {
          id: doc.jobId._id,
          title: doc.jobId.title,
          city: doc.jobId.city,
          seniority: doc.jobId.seniority,
          jobType: doc.jobId.jobType,
          description: doc.jobId.description,
          salary: (doc.jobId.salaryMin && doc.jobId.salaryMax)
            ? `${doc.jobId.salaryMin}-${doc.jobId.salaryMax} ${doc.jobId.currency || 'ريال'}`
            : null,
          company: doc.jobId.companyId ? {
            id: doc.jobId.companyId._id,
            name: doc.jobId.companyId.name,
            logo: doc.jobId.companyId.logo
          } : null,
          stats: {
            viewsCount: doc.jobId.viewsCount || 0,
            applicantsCount: doc.jobId.applicantsCount || 0
          },
          isFeatured: doc.jobId.isFeatured,
          createdAt: doc.jobId.createdAt
        }
      }));

    // 🧮 ثبّت الميتاداتا حتى لو util رجّع شكل مختلف
    const total  = Number(raw?.total ?? mapped.length);
const limit = Number((raw?.limit ?? page.limit ?? mapped.length) ?? 1);
    const cur    = Number(raw?.page  ?? page.page  ?? 1);
    const pages  = Number(raw?.pages ?? Math.max(1, Math.ceil(total / limit)));

    const payload = {
      ...(raw || {}),
      docs: mapped,
      total, page: cur, pages, limit,
      hasNext: cur < pages,
      hasPrev: cur > 1,
    };

    // 📦 أرجع باستخدام withPagination إن وُجد، وإلا JSON مباشر
    if (typeof withPagination === 'function') {
      return withPagination(res, payload);
    }
    return res.json(payload);

  } catch (error) {
    console.error('❌ خطأ في جلب الوظائف المحفوظة:', error);
    return serverError(res, 'حدث خطأ في جلب الوظائف المحفوظة');
  }
};


/**
 * هل هذه الوظيفة محفوظة؟
 * GET /api/saved-jobs/check/:jobId
 */
exports.isSaved = async (req, res) => {
  try {
    const userId = req.auth?.id;
    const { jobId } = req.params;

    if (!userId) return badRequest(res, 'المستخدم غير مُعرف');
    if (!jobId) return badRequest(res, 'معرف الوظيفة مطلوب');
    if (!mongoose.Types.ObjectId.isValid(jobId)) return badRequest(res, 'معرف الوظيفة غير صحيح');

    // استعلام واحد يكفي (بدل exists + findOne)
    const doc = await SavedJob.findOne({ userId, jobId }).select('createdAt').lean();

    return ok(res, {
      jobId,
      saved: !!doc,
      savedAt: doc?.createdAt ?? null
    });

  } catch (error) {
    console.error('❌ خطأ في فحص حالة الحفظ:', error);
    return serverError(res, 'حدث خطأ في فحص حالة الحفظ');
  }
};
/**
 * حالة الحفظ لعدة وظائف دفعة واحدة
 * POST /api/saved-jobs/bulk-check
 */
exports.bulkStatus = async (req, res) => {
  try {
    const userId = req.auth?.id;
    const { jobIds = [] } = req.body;

    // 1) Validation
    if (!userId) {
      return badRequest(res, 'المستخدم غير مُعرف');
    }

    if (!Array.isArray(jobIds)) {
      return badRequest(res, 'jobIds يجب أن تكون مصفوفة');
    }

    if (jobIds.length === 0) {
      return ok(res, { savedJobs: [] });
    }

    if (jobIds.length > 100) {
      return badRequest(res, 'لا يمكن فحص أكثر من 100 وظيفة في المرة الواحدة');
    }

    // 2) فلترة معرفات صحيحة فقط
    const validJobIds = jobIds.filter(id => mongoose.Types.ObjectId.isValid(id));

    if (validJobIds.length === 0) {
      return ok(res, { savedJobs: [] });
    }

    // 3) جلب الوظائف المحفوظة
    const savedJobs = await SavedJob.find({ 
      userId, 
      jobId: { $in: validJobIds } 
    })
    .select('jobId createdAt')
    .lean();

    // 4) تنسيق النتيجة
    const result = savedJobs.map(saved => ({
      jobId: saved.jobId.toString(),
      saved: true,
      savedAt: saved.createdAt
    }));

    // 5) إضافة الوظائف غير المحفوظة
    const savedJobIds = new Set(result.map(r => r.jobId));
    validJobIds.forEach(jobId => {
      if (!savedJobIds.has(jobId.toString())) {
        result.push({
          jobId: jobId.toString(),
          saved: false,
          savedAt: null
        });
      }
    });

    console.log(`🔍 فحص حالة ${validJobIds.length} وظيفة للمستخدم ${userId}`);

    return ok(res, { 
      checkedCount: validJobIds.length,
      savedCount: savedJobs.length,
      savedJobs: result 
    });

  } catch (error) {
    console.error('❌ خطأ في فحص حالة متعددة:', error);
    return serverError(res, 'حدث خطأ في فحص حالة الوظائف');
  }
};

/**
 * إحصائيات الوظائف المحفوظة
 * GET /api/saved-jobs/stats
 */
exports.stats = async (req, res) => {
  try {
    const userId = req.auth?.id;

    if (!userId) {
      return badRequest(res, 'المستخدم غير مُعرف');
    }

    const [totalCount, recentCount] = await Promise.all([
      // إجمالي المحفوظات
      SavedJob.countDocuments({ userId }),
      
      // المحفوظات الحديثة (آخر 7 أيام)
      SavedJob.countDocuments({ 
        userId, 
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      })
    ]);

    return ok(res, {
      total: totalCount,
      recentWeek: recentCount,
      maxAllowed: parseInt(process.env.MAX_SAVED_JOBS || '100')
    });

  } catch (error) {
    console.error('❌ خطأ في جلب إحصائيات المحفوظات:', error);
    return serverError(res, 'حدث خطأ في جلب الإحصائيات');
  }
};

/**
 * تنظيف الوظائف المحفوظة المحذوفة/المنتهية الصلاحية
 * DELETE /api/saved-jobs/cleanup
 */
exports.cleanup = async (req, res) => {
  try {
    const userId = req.auth?.id;

    if (!userId) {
      return badRequest(res, 'المستخدم غير مُعرف');
    }

    // جلب الوظائف المحفوظة التي لم تعد متاحة
    const savedJobs = await SavedJob.find({ userId }).select('jobId').lean();
    const jobIds = savedJobs.map(s => s.jobId);

    if (jobIds.length === 0) {
      return ok(res, { message: 'لا توجد وظائف محفوظة للتنظيف', removedCount: 0 });
    }

    // العثور على الوظائف المتاحة
    const availableJobs = await Job.find({
      _id: { $in: jobIds },
      archived: { $ne: true },
      status: 'open',
      isApproved: true
    }).select('_id').lean();

    const availableJobIds = new Set(availableJobs.map(j => j._id.toString()));
    const unavailableJobIds = jobIds.filter(id => !availableJobIds.has(id.toString()));

    if (unavailableJobIds.length === 0) {
      return ok(res, { message: 'جميع الوظائف المحفوظة متاحة', removedCount: 0 });
    }

    // حذف الوظائف غير المتاحة
    const deleteResult = await SavedJob.deleteMany({
      userId,
      jobId: { $in: unavailableJobIds }
    });

    console.log(`🧹 تم تنظيف ${deleteResult.deletedCount} وظيفة محفوظة للمستخدم ${userId}`);

    return ok(res, {
      message: `تم حذف ${deleteResult.deletedCount} وظيفة غير متاحة من المحفوظات`,
      removedCount: deleteResult.deletedCount
    });

  } catch (error) {
    console.error('❌ خطأ في تنظيف الوظائف المحفوظة:', error);
    return serverError(res, 'حدث خطأ في تنظيف الوظائف');
  }
};

exports.toggle = async (req, res) => {
  try {
    const userId = req.auth?.id;
    const { jobId } = req.body;

    if (!userId) return badRequest(res, 'المستخدم غير مُعرف');
    if (!jobId) return badRequest(res, 'معرف الوظيفة مطلوب');
    if (!mongoose.Types.ObjectId.isValid(jobId)) return badRequest(res, 'معرف الوظيفة غير صحيح');

    // جرّب حذف أولاً
    const del = await SavedJob.deleteOne({ userId, jobId });
    if (del.deletedCount > 0) {
      return ok(res, { saved: false, jobId });
    }

    // لم يكن محفوظًا → احفظه (upsert يحمي من السباقات مع الـ unique index)
    await SavedJob.updateOne(
      { userId, jobId },
      { $setOnInsert: { userId, jobId, createdAt: new Date() } },
      { upsert: true }
    );
    return ok(res, { saved: true, jobId });

  } catch (error) {
    console.error('❌ خطأ في toggle:', error);
    return serverError(res, 'حدث خطأ في تبديل حالة الحفظ');
  }
};