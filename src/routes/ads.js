// routes/ads.js
const express = require("express");
const router = express.Router();
const Ad = require("../models/Ad");
const AdPlan = require("../models/AdPlan");

// ✅ جلب الإعلانات النشطة فقط (مع إمكانية التصفية حسب الموقع أو الشركة)
router.get("/", async (req, res) => {
  try {
    const { location, company } = req.query;

    const filter = {
      status: "active",
      expiresAt: { $gte: new Date() },
    };
    if (location) filter.location = location;
    if (company) filter.company = company;

    const ads = await Ad.find(filter).sort({ createdAt: -1 });
    res.json({ ads });
  } catch (err) {
    res.status(500).json({ message: "خطأ في جلب الإعلانات", error: err.message });
  }
});

// ✅ إضافة إعلان جديد (مع التحقق من الباقة)
router.post("/", async (req, res) => {
  try {
    const { title, description, image, company, link, planId, location } = req.body;

    // 🔹 جلب بيانات الباقة
    const plan = await AdPlan.findOne({ id: planId });
    if (!plan) return res.status(400).json({ message: "الباقة غير صالحة" });

    // 🔹 تحقق من الحد الشهري
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const adsCount = await Ad.countDocuments({
      company,
      planId,
      createdAt: { $gte: monthStart },
    });

    if (plan.adsLimit && adsCount >= plan.adsLimit) {
      return res.status(403).json({
        message: "لقد استهلكت الحد الأقصى من الإعلانات لهذه الباقة",
      });
    }

    // 🔹 حساب تاريخ الانتهاء تلقائيًا حسب مدة الباقة
    const expiresAt = new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000);

    // 🔹 إنشاء إعلان جديد
    const ad = new Ad({
      title,
      description,
      image,
      company,
      link,
      planId,
      location: location || "home",
      status: "active",
      expiresAt,
    });

    await ad.save();
    res.status(201).json({ ad });
  } catch (err) {
    res.status(400).json({ message: "خطأ في إضافة الإعلان", error: err.message });
  }
});

// ✅ تعديل إعلان
router.put("/:id", async (req, res) => {
  try {
    const ad = await Ad.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!ad) return res.status(404).json({ message: "الإعلان غير موجود" });
    res.json({ ad });
  } catch (err) {
    res.status(400).json({ message: "خطأ في تعديل الإعلان", error: err.message });
  }
});

// ✅ حذف إعلان
router.delete("/:id", async (req, res) => {
  try {
    const ad = await Ad.findByIdAndDelete(req.params.id);
    if (!ad) return res.status(404).json({ message: "الإعلان غير موجود" });
    res.json({ message: "تم حذف الإعلان" });
  } catch (err) {
    res.status(500).json({ message: "خطأ في حذف الإعلان", error: err.message });
  }
});

// ✅ تحديث عدد النقرات/المشاهدات (لتتبع الأداء)
router.post("/:id/track", async (req, res) => {
  try {
    const { type } = req.body; // view | click
    const update = type === "click" ? { $inc: { clicksCount: 1 } } : { $inc: { viewsCount: 1 } };

    const ad = await Ad.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!ad) return res.status(404).json({ message: "الإعلان غير موجود" });

    res.json({ ad });
  } catch (err) {
    res.status(400).json({ message: "خطأ في تتبع الإعلان", error: err.message });
  }
});

module.exports = router;
