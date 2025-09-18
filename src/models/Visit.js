// models/Visit.js
const mongoose = require("mongoose");

const visitSchema = new mongoose.Schema({
  visitorId: { type: String, index: true },
  ip: String,
  userAgent: String,
  path: String,
  referrer: String,
  sessionId: String,
  createdAt: { type: Date, default: Date.now, index: true },

  // نافذة زمنية للتجميع (مثال 5 ثواني)
  tsBucket: { type: Number, index: true } // timestamp bucket
});

// فهرس يمنع التكرار لنفس (الزائر/الجلسة/المسار) داخل نفس الباكت
visitSchema.index({ visitorId: 1, sessionId: 1, path: 1, tsBucket: 1 }, { unique: true });

module.exports = mongoose.model("Visit", visitSchema);
