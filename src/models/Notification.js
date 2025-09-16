const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:   { type: String, enum: ['application_status','new_applicant','admin_notice','generic'], required: true },
  title:  { type: String, required: true, trim: true, maxlength: 140 },
  body:   { type: String, trim: true, maxlength: 1000 },
  data:   { type: mongoose.Schema.Types.Mixed },
  read:   { type: Boolean, default: false, index: true },
  readAt: { type: Date }
}, { timestamps: { createdAt: true, updatedAt: false } });

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

notificationSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => { ret.id = ret._id; delete ret._id; return ret; }
});

module.exports = mongoose.model('Notification', notificationSchema);
