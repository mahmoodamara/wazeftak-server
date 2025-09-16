const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  companyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  title:       { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 8000 },
  city:        { type: String, required: true, trim: true, index: true },
  type:        { type: String, enum: ['full_time','part_time','contract','internship','temporary'], index: true },
  tags:        [{ type: String, trim: true, lowercase: true, maxlength: 40 }],

  // قنوات التقديم
  applyMethod: { type: String, enum: ['in_app','email','whatsapp','external_url'], default: 'in_app' },
  applyTarget: { type: String, trim: true },

  // اعتماد/إبراز/أرشفة
  isApproved:  { type: Boolean, default: false, index: true },
  approvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt:  { type: Date },
  isFeatured:  { type: Boolean, default: false, index: true },
  archived:    { type: Boolean, default: false, index: true },
  status:      { type: String, enum: ['open','closed'], default: 'open', index: true },

  // قياس
  applicantsCount: { type: Number, default: 0 },
  viewsCount:      { type: Number, default: 0 },

  // تكامل مع taxonomies
  fieldSlugs:   [{ type: String, lowercase: true, trim: true, maxlength: 50 }],
  skillSlugs:   [{ type: String, lowercase: true, trim: true, maxlength: 50 }],
  seniority:     { type: String, lowercase: true, trim: true },
  jobTypeSlug:   { type: String, lowercase: true, trim: true }
}, { timestamps: true });

jobSchema.index({ companyId: 1, createdAt: -1 });
jobSchema.index({ companyId: 1, status: 1, archived: 1 });

jobSchema.index(
  { title: 'text', description: 'text', city: 'text', tags: 'text' },
  { weights: { title: 10, description: 4, city: 2, tags: 3 } }
);
jobSchema.index({ isApproved: 1, archived: 1, city: 1, jobTypeSlug: 1, createdAt: -1 });
jobSchema.index({ companyId: 1, archived: 1, createdAt: -1 });
jobSchema.index({ fieldSlugs: 1 });
jobSchema.index({ skillSlugs: 1 });

jobSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => { ret.id = ret._id; delete ret._id; return ret; }
});

jobSchema.path('applyTarget').validate(function(v) {
  if (this.applyMethod === 'in_app') return true;
  if (v == null || String(v).trim().length === 0) return false;
  const val = String(v).trim();
  if (this.applyMethod === 'email') return val.includes('@');
  if (this.applyMethod === 'whatsapp') return /^(\+?\d[\d\s-]{6,}|https?:\/\/wa\.me\/\d+)/i.test(val);
  if (this.applyMethod === 'external_url') return /^https?:\/\//i.test(val);
  return true;
}, 'applyTarget مطلوب/غير صالح بالنسبة لقناة التقديم');

jobSchema.post('save', async function(doc, next) {
  try {
    if (doc.isNew && !doc.archived) {
      await mongoose.model('Company').updateOne({ _id: doc.companyId }, { $inc: { activeJobsCount: 1 } });
    }
    next();
  } catch (e) { next(e); }
});

jobSchema.post('findOneAndUpdate', async function(res, next) {
  try {
    const update = this.getUpdate() || {};
    if (!res) return next();
    const set = update.$set || {};
    if (Object.prototype.hasOwnProperty.call(set, 'archived')) {
      const was = !!res.archived;
      const now = !!set.archived;
      if (was !== now) {
        await mongoose.model('Company').updateOne(
          { _id: res.companyId },
          { $inc: { activeJobsCount: now ? -1 : 1 } }
        );
      }
    }
    next();
  } catch (e) { next(e); }
});

module.exports = mongoose.model('Job', jobSchema);
