// models/Application.js
const mongoose = require('mongoose');

const ALLOWED_STATUSES = ['pending','reviewed','interview','accepted','rejected'];

const applicationSchema = new mongoose.Schema({
  jobId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true }, // denormalized

  message:   { type: String, trim: true, maxlength: 1500 },

  // ---- حقول الـ CV (توافقية قديمة + ميتاداتا) ----
  cvFileId:  { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
  cvUrl:     { type: String, trim: true },
  cvName:    { type: String, trim: true, maxlength: 200 },      // اسم العرض / اسم الملف
  cvMime:    { type: String, trim: true, maxlength: 120 },      // مثال: application/pdf
  cvSize:    { type: Number, min: 0 },                          // بالبايت

  status:    { type: String, enum: ALLOWED_STATUSES, default: 'pending', index: true }
}, {
  timestamps: true,
  minimize: true,
  strict: true
});

// ====== فهارس ======
applicationSchema.index({ jobId: 1, userId: 1 }, { unique: true });
applicationSchema.index({ companyId: 1, status: 1, createdAt: -1 });
applicationSchema.index({ userId: 1, createdAt: -1 });
applicationSchema.index({ jobId: 1, createdAt: -1 });
applicationSchema.index({ cvFileId: 1 });

// تأكد من وجودها
applicationSchema.index({ jobId: 1, createdAt: -1 });
applicationSchema.index({ jobId: 1, status: 1 });

// ====== أدوات ======
const buildDownloadUrl = (fileId) => (fileId ? `/api/files/${fileId}/download` : null);

// ====== إخراج كائن/JSON + Virtual موحّد للـ CV ======
function commonTransform(_doc, ret) {
  ret.id = ret._id;
  delete ret._id;

  const kind = ret.cvFileId ? 'file' : (ret.cvUrl ? 'url' : null);
  ret.cv = kind ? {
    kind,
    fileId: ret.cvFileId || undefined,
    url: ret.cvUrl || undefined,
    originalName: ret.cvName || undefined,
    mime: ret.cvMime || undefined,
    size: (typeof ret.cvSize === 'number' ? ret.cvSize : undefined),
    downloadUrl: ret.cvFileId ? buildDownloadUrl(ret.cvFileId) : (ret.cvUrl || undefined)
  } : null;

  return ret;
}

applicationSchema.set('toJSON', { virtuals: true, versionKey: false, transform: commonTransform });
applicationSchema.set('toObject', { virtuals: true, versionKey: false, transform: commonTransform });

// ====== تحققات ======
applicationSchema.path('cvUrl').validate(function (v) {
  if (v == null) return true;
  return typeof v === 'string' && v.trim().length > 0;
}, 'cvUrl غير صالح');

// XOR: لا يجوز إرسال cvFileId و cvUrl معًا + ربط companyId من الوظيفة
applicationSchema.pre('validate', async function(next) {
  try {
    if (!this.companyId && this.jobId) {
      const job = await mongoose.model('Job')
        .findById(this.jobId)
        .select('companyId')
        .lean();
      if (job?.companyId) this.companyId = job.companyId;
    }

    if (this.cvFileId && this.cvUrl) {
      return next(Object.assign(new Error('أرسل إمّا ملف السيرة الذاتية أو رابطًا، وليس الاثنين'), { status: 400 }));
    }

    next();
  } catch (e) { next(e); }
});

// عدّاد المتقدمين
applicationSchema.post('save', async function(doc, next) {
  try {
    if (doc.isNew) {
      await mongoose.model('Job').updateOne({ _id: doc.jobId }, { $inc: { applicantsCount: 1 } });
    }
    next();
  } catch (e) { next(e); }
});

applicationSchema.post('findOneAndDelete', async function(res, next) {
  try {
    if (res?.jobId) {
      await mongoose.model('Job').updateOne({ _id: res.jobId }, { $inc: { applicantsCount: -1 } });
    }
    next();
  } catch (e) { next(e); }
});

applicationSchema.post('deleteOne', { document: true, query: false }, async function(_doc, next) {
  try {
    if (this?.jobId) {
      await mongoose.model('Job').updateOne({ _id: this.jobId }, { $inc: { applicantsCount: -1 } });
    }
    next();
  } catch (e) { next(e); }
});

// ====== عمليات ثابتة ======
applicationSchema.statics.apply = async function({
  job,
  userId,
  message,
  cvFileId,
  cvUrl,
  cvName,
  cvMime,
  cvSize
}) {
  // منع ملف + رابط معًا (حماية مضاعفة)
  if (cvFileId && cvUrl) {
    const err = Object.assign(new Error('أرسل إمّا ملف السيرة الذاتية أو رابطًا، وليس الاثنين'), { status: 400 });
    throw err;
  }

  // إثراء ميتاداتا الملف إن لزم
  if (cvFileId && (!cvName || !cvMime || (typeof cvSize !== 'number'))) {
    try {
      const File = mongoose.model('File'); // غيّر الاسم إذا كان موديلك مختلف
      const f = await File.findById(cvFileId).select('originalName mime size').lean();
      if (f) {
        cvName = cvName || f.originalName;
        cvMime = cvMime || f.mime;
        if (typeof cvSize !== 'number') cvSize = (typeof f.size === 'number' ? f.size : undefined);
      }
    } catch (_) { /* تجاهل */ }
  }

  return this.create({
    jobId: job._id,
    userId,
    companyId: job.companyId,
    message: message?.trim(),
    cvFileId: cvFileId || undefined,
    cvUrl: (!cvFileId ? (cvUrl || undefined) : undefined),
    cvName: cvName || (cvUrl ? 'CV' : undefined),
    cvMime: cvMime || undefined,
    cvSize: (typeof cvSize === 'number' ? cvSize : undefined),
    status: 'pending'
  });
};

applicationSchema.statics.updateStatus = async function(appId, nextStatus) {
  if (!ALLOWED_STATUSES.includes(nextStatus)) {
    throw Object.assign(new Error('حالة غير مدعومة'), { status: 422 });
  }
  return this.findByIdAndUpdate(appId, { $set: { status: nextStatus } }, { new: true });
};

module.exports = mongoose.model('Application', applicationSchema);
