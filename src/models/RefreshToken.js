const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  userAgent: { type: String, trim: true },
  ip:        { type: String, trim: true },
  expiresAt: { type: Date, required: true, index: true },
  revokedAt: { type: Date }
}, { timestamps: { createdAt: true, updatedAt: false } });

refreshTokenSchema.index({ userId: 1, expiresAt: 1 });

refreshTokenSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => { ret.id = ret._id; delete ret._id; return ret; }
});

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
