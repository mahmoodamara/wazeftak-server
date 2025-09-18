// models/VerificationToken.js
const mongoose = require('mongoose');

const TYPES = ['email', 'phone', 'password_reset'];

const verificationTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // نوع التحقق: بريد، هاتف، إعادة تعيين كلمة المرور
    type: {
      type: String,
      enum: TYPES, // ['email', 'phone', 'password_reset']
      required: true,
      index: true,
    },

    // تخزين الرمز مجزّأ (sha256 hex عادةً بطول 64 حرف)
    tokenHash: {
      type: String,
      required: true,
      minlength: 32,
      maxlength: 128,
      match: /^[a-f0-9]{32,128}$/i, // يسمح 64 بشكل أساسي، ويوسّع قليلاً للمرونة
    },

    // البريد/الهاتف الذي تم الإرسال إليه (اختياري للشفافية)
    destination: { type: String, trim: true },

    // محاولات متبقية لإدخال OTP (يُستخدم عادةً مع type='email')
    attemptsLeft: {
      type: Number,
      default: 5,
      min: 0,
      max: 10,
    },

    // آخر وقت إرسال (لمنع الإرسال المتكرر خلال مدة قصيرة)
    lastSentAt: { type: Date },

    // صلاحية التوكن (مع TTL index)
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    // إذا استُعمل بنجاح → نحط التاريخ هنا
    usedAt: { type: Date },
  },
  {
    // لا نحتاج updatedAt هنا لتجنب تغييرات تلقائية
    timestamps: { createdAt: true, updatedAt: false },
  }
);

/* ============================ Normalization ============================ */
// دعم اسم قديم: 'reset_password' → نحوله إلى 'password_reset'
verificationTokenSchema.pre('validate', function normalizeType(next) {
  if (this.type === 'reset_password') this.type = 'password_reset';
  next();
});

/* =============================== Indexes =============================== */
// استعلامات شائعة: userId + type + أحدث سجل
verificationTokenSchema.index({ userId: 1, type: 1, createdAt: -1 });

// lookup بالتحقق عبر tokenHash (للتحقق من صلاحية الرابط/الرمز)
verificationTokenSchema.index({ type: 1, tokenHash: 1 }, { unique: false });

// فهرس مركب إضافي يحسّن جملة usedAt exists + sort
verificationTokenSchema.index({ userId: 1, type: 1, usedAt: 1, createdAt: -1 });

// TTL: يحذف الوثيقة تلقائيًا عند انتهاء الصلاحية
verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/* ============================= toJSON Clean ============================ */
verificationTokenSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('VerificationToken', verificationTokenSchema);
