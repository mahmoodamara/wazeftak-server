// models/Lead.js
const { Schema, model } = require("mongoose");

const leadSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["seeker", "company"],
      required: true,
      index: true,
    },

    name: { type: String, required: true, trim: true, maxlength: 150 },
    phone: { type: String, required: true, trim: true, maxlength: 30, index: true },
    email: { type: String, trim: true, lowercase: true, maxlength: 200, index: true },
    city: { type: String, trim: true, maxlength: 120 },

    seeker_role: { type: String, trim: true, maxlength: 160 },
    seeker_experience: { type: String, trim: true, maxlength: 160 },
    seeker_notes: { type: String, trim: true, maxlength: 1000 },

    company_name: { type: String, trim: true, maxlength: 160 },
    job_title: { type: String, trim: true, maxlength: 160 },
    job_type: { type: String, trim: true, maxlength: 160 },
    company_notes: { type: String, trim: true, maxlength: 1000 },

    salary: {
      mode: {
        type: String,
        enum: ["hourly", "daily", "monthly", "yearly"],
        default: "monthly",
      },
      min: { type: Number, min: 0 },
      max: { type: Number, min: 0 },
      currency: {
        type: String,
        default: "ILS",
        uppercase: true,
        maxlength: 6,
      },
    },

    meta: {
      ip: { type: String, index: true },
      userAgent: { type: String },
      referer: { type: String },
    },
  },
  { timestamps: true }
);

/* ---------------------- HIGH PERFORMANCE INDEXES ----------------------- */

// createdAt index (أساسي لكل queries)
leadSchema.index({ createdAt: -1 }, { background: true });

// rate-limit indexes
leadSchema.index({ email: 1, createdAt: -1 }, { background: true });
leadSchema.index({ phone: 1, createdAt: -1 }, { background: true });
leadSchema.index(
  { "meta.ip": 1, "meta.userAgent": 1, createdAt: -1 },
  { background: true }
);

// universal sparse index
leadSchema.index(
  { email: 1, phone: 1, "meta.ip": 1, createdAt: -1 },
  { sparse: true, background: true }
);

// admin search indexes
leadSchema.index({ name: 1 }, { background: true });
leadSchema.index({ city: 1 }, { background: true });
leadSchema.index({ seeker_role: 1 }, { background: true });
leadSchema.index({ company_name: 1 }, { background: true });
leadSchema.index({ job_title: 1 }, { background: true });

// salary sanity check
leadSchema.pre("validate", function (next) {
  const s = this.salary;
  if (s && s.min != null && s.max != null && s.min > s.max) {
    return next(new Error("الحد الأدنى للراتب لا يمكن أن يكون أكبر من الحد الأقصى"));
  }
  next();
});

module.exports = model("Lead", leadSchema);
