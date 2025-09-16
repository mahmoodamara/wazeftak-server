const mongoose = require('mongoose');

const taxonomySchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['city','field','skill','job_type','seniority','education','language','transport','benefit'], 
    required: true, index: true 
  },
  slug: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  },
  label: {
    ar: { type: String, required: true, trim: true, maxlength: 80 },
    he: { type: String, trim: true, maxlength: 80 },
    en: { type: String, trim: true, maxlength: 80 }
  },
  parentSlug: { type: String, trim: true, lowercase: true },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true, index: true },
  meta: {
    lat: Number,
    lng: Number,
    color: { type: String, match: /^#?[0-9a-fA-F]{6}$/ }
  }
}, { timestamps: true });

taxonomySchema.index({ type: 1, slug: 1 }, { unique: true });
taxonomySchema.index({ type: 1, order: 1 });
taxonomySchema.index({ type: 1, parentSlug: 1 });

taxonomySchema.pre('validate', function(next) {
  if (this.slug) this.slug = this.slug.toLowerCase().trim();
  if (this.parentSlug) this.parentSlug = this.parentSlug.toLowerCase().trim();
  next();
});

taxonomySchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => { ret.id = ret._id; delete ret._id; return ret; }
});

module.exports = mongoose.model('Taxonomy', taxonomySchema);
