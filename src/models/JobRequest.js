// models/JobRequest.js
const mongoose = require("mongoose");

// models/JobRequest.js
const jobRequestSchema = new mongoose.Schema({
  companyName: String,
  contactName: String,
  email: { type: String, required: true, index: true },
  phone: String,
  jobTitle: String,
  city: String,
  description: String,
  website: String,
  source: String,
  ip: String,
  userAgent: String,
  lastSentAt: Date, // آخر وقت إرسال
}, { timestamps: true });


module.exports = mongoose.model("JobRequest", jobRequestSchema);
