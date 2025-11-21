// models/Lead.js
const { Schema, model } = require("mongoose");

const leadSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["seeker", "company"],
      required: true,
    },

    // مشترك
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    city: { type: String, trim: true },

    // باحث عن عمل
    seeker_role: { type: String, trim: true },
    seeker_experience: { type: String, trim: true },
    seeker_notes: { type: String, trim: true },

    // صاحب شركة
    company_name: { type: String, trim: true },
    job_title: { type: String, trim: true },
    job_type: { type: String, trim: true },
    company_notes: { type: String, trim: true },

    meta: {
      ip: String,
      userAgent: String,
      referer: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = model("Lead", leadSchema);
