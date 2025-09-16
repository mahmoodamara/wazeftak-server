// models/SavedJob.js
const mongoose = require('mongoose');

const savedJobSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  jobId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Job',  required: true, index: true }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

savedJobSchema.index({ userId: 1, jobId: 1 }, { unique: true });
savedJobSchema.index({ userId: 1, createdAt: -1 });

savedJobSchema.set('toObject', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    if (ret.jobId) {
      ret.job = ret.jobId;
      delete ret.jobId;
    }
    return ret;
  }
});

module.exports = mongoose.model('SavedJob', savedJobSchema);
