const mongoose = require("mongoose");

const adPlanSchema = new mongoose.Schema({
  id: { type: String, unique: true }, // free | basic | pro
  name: String,
  price: Number,
  period: String,
  tagline: String,
  features: [String],
  adsLimit: Number,   // الحد الأقصى من الإعلانات/شهر
  durationDays: Number, // كم يوم يظهر الإعلان
});

module.exports = mongoose.model("AdPlan", adPlanSchema);
