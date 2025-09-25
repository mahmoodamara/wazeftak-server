const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  role:        { type: String, enum: ['job_seeker','company','admin'], required: true, index: true },
  name:        { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  email:       { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
  phone:       { type: String, trim: true, unique: true, sparse: true },
city: { type: String, trim: true }, // بدون required
  locale:      { type: String, enum: ['ar','he','en'], default: 'ar' },
  passwordHash:{ type: String, required: true, select: false },
  companyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },

  // تحقق/تعطيل (آمنة للإضافة لاحقاً)
  emailVerified: { type: Boolean, default: false, index: true },
  emailVerifiedAt: { type: Date }, // ✅ جديد (اختياري)

  phoneVerified: { type: Boolean, default: false, index: true },
  disabled:      { type: Boolean, default: false, index: true },
  defaultCvFileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File', index: true },

}, { timestamps: true });

userSchema.index({ role: 1, emailVerified: 1, phoneVerified: 1 });
userSchema.index({ profession: 1, role: 1, emailVerified: 1, disabled: 1 });

userSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  }
});
module.exports = mongoose.model('User', userSchema);
