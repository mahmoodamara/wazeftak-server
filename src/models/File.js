// models/File.js
const mongoose = require('mongoose');
const pathLib = require('path');

const FILE_SCOPES = ['cv','company_logo','job_attachment','generic'];
const VISIBILITY  = ['private','public'];
const STORAGES    = ['local'];

// للـ CV نسمح بهذه الأنواع فقط
const ALLOWED_CV_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const fileSchema = new mongoose.Schema({
  ownerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  scope:      { type: String, enum: FILE_SCOPES, required: true, index: true },
  visibility: { type: String, enum: VISIBILITY, default: 'private', index: true },

  storage: { type: String, enum: STORAGES, default: 'local' },
  path:    { type: String, required: true }, // relative path in uploads (e.g. "cv/2025/09/abc.pdf")
  url:     { type: String, required: true }, // public/served url (e.g. "/static/cv/2025/09/abc.pdf")

  originalName: { type: String, trim: true, maxlength: 255 },
  mimeType:     { type: String, required: true, trim: true }, // NOTE: نستخدم mimeType كأساس
  size:         { type: Number, required: true, min: 0 },     // bytes

  width:  Number,
  height: Number,
  pages:  Number,

  // لمنع ازدواجية اختيارية (يمكن فهرستها)
  checksum: { type: String, trim: true, index: true },

  // ربط اختياري بكيان
  linkTo: {
    model: { type: String, enum: ['Job','Company','Application','User'] },
    id:    { type: mongoose.Schema.Types.ObjectId }
  }
}, { timestamps: true });

// ===== فهارس =====
fileSchema.index({ ownerId: 1, scope: 1, createdAt: -1 });
fileSchema.index({ visibility: 1, createdAt: -1 });
fileSchema.index({ 'linkTo.model': 1, 'linkTo.id': 1, createdAt: -1 });

// ===== Virtuals مفيدة =====

// alias للتوافق مع أي كود قديم يستخدم "mime"
fileSchema.virtual('mime')
  .get(function () { return this.mimeType; })
  .set(function (v) { this.mimeType = v; });

// اسم الملف من المسار
fileSchema.virtual('filename')
  .get(function () { return this.path ? pathLib.basename(this.path) : undefined; });

// أعلام مفيدة
fileSchema.virtual('isImage')
  .get(function () { return /^image\//.test(this.mimeType || ''); });

fileSchema.virtual('isPdf')
  .get(function () { return (this.mimeType || '') === 'application/pdf'; });

// رابط تنزيل آمن (route مخصص للتحكم في الصلاحيات/الرؤوس)
fileSchema.methods.getDownloadUrl = function () {
  return `/api/files/${this._id}/download`;
};

// ===== إخراج JSON نظيف =====
fileSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;

    // وفّر downloadUrl بجانب url العام
    ret.downloadUrl = `/api/files/${ret.id}/download`;

    return ret;
  }
});

// ===== تحقق قبل التحقق/الحفظ =====
fileSchema.pre('validate', function (next) {
  try {
    // ملء url تلقائيًا عند التخزين المحلي إذا لم يُمرّر
    if (this.storage === 'local' && !this.url && this.path) {
      // التزم بنمط /static/<path>
      this.url = `/static/${this.path.replace(/^\/+/, '')}`;
    }

    // لو ملف CV، تأكد من النوع المسموح
    if (this.scope === 'cv' && this.mimeType) {
      if (!ALLOWED_CV_MIME.includes(this.mimeType)) {
        return next(Object.assign(new Error('نوع ملف CV غير مدعوم'), { status: 422 }));
      }
    }

    next();
  } catch (e) { next(e); }
});

module.exports = mongoose.model('File', fileSchema);
