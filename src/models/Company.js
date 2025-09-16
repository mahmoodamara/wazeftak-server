const mongoose = require('mongoose');

const CHANNELS = ['in_app','email','whatsapp','external_url'];
const STATUSES = ['active','suspended'];

const companySchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: {
    type: String,
    trim: true,
    lowercase: true,
    match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    unique: true,
    sparse: true,
    index: true
  },

  city: { type: String, trim: true },
  citySlug: { type: String, trim: true, lowercase: true },
  address: { type: String, trim: true, maxlength: 200 },

  about: { type: String, trim: true, maxlength: 2000 },
  logoUrl: { type: String, trim: true },
  coverUrl: { type: String, trim: true },

  contactEmail: { type: String, trim: true, lowercase: true },
  contactPhone: { type: String, trim: true },

  website: { type: String, trim: true },
  socials: {
    facebook: { type: String, trim: true },
    instagram:{ type: String, trim: true },
    linkedin: { type: String, trim: true },
    x:        { type: String, trim: true },
    whatsapp: { type: String, trim: true }
  },

  applicationChannel: { type: String, enum: CHANNELS, default: 'in_app' },
  applicationTarget:  { type: String, trim: true },

  status:     { type: String, enum: STATUSES, default: 'active', index: true },
  verified:   { type: Boolean, default: false, index: true },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: { type: Date },

  activeJobsCount: { type: Number, default: 0 }
}, { timestamps: true });

companySchema.index(
  { name: 'text', about: 'text', city: 'text' },
  { weights: { name: 10, about: 4, city: 2 } }
);
companySchema.index({ city: 1, verified: 1, activeJobsCount: -1 });
companySchema.index({ status: 1, verified: 1, createdAt: -1 });

companySchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => { ret.id = ret._id; delete ret._id; return ret; }
});

companySchema.pre('validate', function(next) {
  if (this.slug) this.slug = String(this.slug).toLowerCase().trim();
  if (this.citySlug) this.citySlug = String(this.citySlug).toLowerCase().trim();
  next();
});

companySchema.path('applicationTarget').validate(function (v) {
  if (this.applicationChannel === 'in_app') return true;
  if (v == null || String(v).trim().length === 0) return false;
  const val = String(v).trim();
  if (this.applicationChannel === 'email') return val.includes('@');
  if (this.applicationChannel === 'whatsapp') return /^(\+?\d[\d\s-]{6,}|https?:\/\/wa\.me\/\d+)/i.test(val);
  if (this.applicationChannel === 'external_url') return /^https?:\/\//i.test(val);
  return true;
}, 'applicationTarget غير صالح لقناة التقديم المحددة');

companySchema.statics.ensureSlug = async function (company) {
  if (company.slug) return company.slug;
  const base = String(company.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'company';
  let slug = base, i = 1;
  while (await this.exists({ slug })) slug = `${base}-${i++}`;
  company.slug = slug;
  return slug;
};

module.exports = mongoose.model('Company', companySchema);
