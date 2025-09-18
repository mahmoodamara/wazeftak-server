const mongoose = require("mongoose");

const adSchema = new mongoose.Schema(
  {
    // 📰 بيانات الإعلان الأساسية
    title: { type: String, required: true },        // عنوان الإعلان
    description: { type: String, required: true },  // نص الإعلان الكامل
    image: { type: String },                        // رابط صورة أو بانر
    company: { type: String, required: true },      // اسم الشركة المعلِنة
    link: { type: String },                         // رابط خارجي (موقع/تسجيل)

    // 🎯 ميتا + الباقات
    planId: { type: String, enum: ["free", "basic", "pro"], required: true },
    location: {
      type: String,
      enum: ["home", "jobs", "both"], // وين يظهر (الصفحة الرئيسية / صفحة الوظائف / الاثنين)
      default: "home",
    },
    status: {
      type: String,
      enum: ["active", "expired", "pending"], // حالة الإعلان
      default: "pending",
    },

    // 📊 تتبّع التفاعل
    viewsCount: { type: Number, default: 0 },   // عدد المشاهدات
    clicksCount: { type: Number, default: 0 },  // عدد النقرات

    // ⏳ صلاحية ومدّة
    startDate: { type: Date, default: Date.now },  // بداية العرض
    expiresAt: { type: Date, required: true },     // نهاية الصلاحية

    // ⚡ خيارات إضافية
    isHighlighted: { type: Boolean, default: false }, // مميز بإطار/لون
    priority: { type: Number, default: 0 },           // للتحكم بترتيب الظهور (أعلى أولوية يظهر أول)

    // 🔒 مالك الإعلان
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // صاحب الإعلان
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ad", adSchema);
