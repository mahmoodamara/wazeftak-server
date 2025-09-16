const mongoose = require('mongoose');

const verificationTokenSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },

  // نوع التحقق: بريد، هاتف، إعادة تعيين كلمة المرور
  type: { 
    type: String, 
    enum: ['email', 'phone', 'reset_password'], 
    required: true, 
    index: true 
  },

  // تخزين الرمز مجزّأ (sha256)
  tokenHash: { type: String, required: true },

  // البريد/الهاتف الذي تم الإرسال إليه (للشفافية)
  destination: { type: String },

  // عدد المحاولات المتبقية لإدخال الـ OTP
  attemptsLeft: { type: Number, default: 5 },

  // آخر وقت إرسال (لمنع الإرسال المتكرر خلال مدة قصيرة)
  lastSentAt: { type: Date },

  // صلاحية التوكن (مع TTL index)
  expiresAt: { type: Date, required: true, index: true },

  // إذا استُعمل بنجاح → نحط التاريخ هنا
  usedAt: { type: Date },

}, { 
  timestamps: { createdAt: true, updatedAt: false } 
});

// فهرس مركب لتحسين الاستعلامات
verificationTokenSchema.index({ userId: 1, type: 1, expiresAt: 1 });

// فهرس TTL: يحذف الوثيقة تلقائيًا عند انتهاء الصلاحية
verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

verificationTokenSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => { 
    ret.id = ret._id; 
    delete ret._id; 
    return ret; 
  }
});

module.exports = mongoose.model('VerificationToken', verificationTokenSchema);
