const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  jobId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason:  { type: String, enum: ['spam','fake','inappropriate','other'], required: true },
  note:    { type: String, trim: true, maxlength: 1000 },
  resolved:{ type: Boolean, default: false, index: true },
  resolvedAt: { type: Date }
}, { timestamps: true });

reportSchema.index({ resolved: 1, createdAt: -1 });

reportSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => { ret.id = ret._id; delete ret._id; return ret; }
});

module.exports = mongoose.model('Report', reportSchema);
