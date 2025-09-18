const mongoose = require('mongoose');

const JobViewSchema = new mongoose.Schema({
  jobId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  viewerKey: { type: String, required: true, index: true }, // u:<userId> أو a:<anonId>
  firstViewedAt: { type: Date, default: Date.now },
  lastViewedAt:  { type: Date, default: Date.now },
}, { timestamps: true });

// ✅ فريد: نفس الشخص لنفس الوظيفة مرّة واحدة فقط
JobViewSchema.index({ jobId: 1, viewerKey: 1 }, { unique: true });

module.exports = mongoose.model('JobView', JobViewSchema);