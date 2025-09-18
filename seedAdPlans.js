// scripts/seedAdPlans.js
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const AdPlan = require("./src/models/AdPlan"); // عدل المسار إذا مختلف

const plans = [
  {
    id: "free",
    name: "الخطة المجانية",
    price: 0,
    period: "/شهر",
    tagline: "إعلان مميز واحد للتجربة",
    features: [
      "إعلان واحد مميز يظهر في الصفحة الرئيسية",
      "المدة: 7 أيام",
      "مناسبة للشركات الجديدة لتجربة الخدمة",
    ],
    durationDays: 7,
    maxAdsPerMonth: 1,
    recommended: false,
  },
  {
    id: "basic",
    name: "الباقة الأساسية",
    price: 249,
    period: "/شهر",
    tagline: "3 إعلانات مميزة شهريًا",
    features: [
      "الظهور في قسم «إعلانات مميزة» بالصفحة الرئيسية",
      "مدة العرض: 30 يومًا",
      "مناسبة للشركات الصغيرة أو الأفراد",
    ],
    durationDays: 30,
    maxAdsPerMonth: 3,
    recommended: false,
  },
  {
    id: "pro",
    name: "الباقة المتوسطة",
    price: 599,
    period: "/شهر",
    tagline: "8 إعلانات مميزة شهريًا",
    features: [
      "الظهور في قسم «إعلانات مميزة» + إبراز في قوائم الوظائف",
      "إمكانية اختيار مكان الظهور (الرئيسية / صفحة الوظائف)",
      "تفاعل أعلى مع الباحثين عن عمل",
    ],
    durationDays: 30,
    maxAdsPerMonth: 8,
    recommended: true,
  },
  {
    id: "gold",
    name: "الباقة الذهبية",
    price: 999,
    period: "/شهر",
    tagline: "إعلانات غير محدودة للشركات الكبيرة",
    features: [
      "عدد غير محدود من الإعلانات المميزة",
      "أولوية قصوى في الظهور والبحث",
      "ترويج عبر قنوات إضافية (واتساب/إيميل)",
    ],
    durationDays: 30,
    maxAdsPerMonth: 999,
    recommended: false,
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ متصل بقاعدة البيانات");

    await AdPlan.deleteMany({});
    console.log("🗑️ تم مسح الباقات القديمة");

    await AdPlan.insertMany(plans);
    console.log("✨ تم إدخال الباقات بنجاح");

    mongoose.disconnect();
  } catch (err) {
    console.error("❌ خطأ:", err);
    process.exit(1);
  }
}

seed();
