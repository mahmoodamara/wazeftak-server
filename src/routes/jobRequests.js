// routes/jobRequests.js
const express = require("express");
const router = express.Router();
const JobRequest = require("../models/JobRequest");

// POST /api/job-requests
router.post("/", async (req, res) => {
  try {
    const { email } = req.body;
    const ip = req.ip;

    // ✅ تحقق أن الإيميل موجود وصحيح
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({
        success: false,
        reason: "invalid_email",
        message: "الرجاء إدخال بريد إلكتروني صالح قبل إرسال الطلب."
      });
    }

    // بداية ونهاية اليوم
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // عدد الطلبات اليوم من نفس الإيميل+IP
    const count = await JobRequest.countDocuments({
      email,
      ip,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    if (count >= 3) {
      return res.status(429).json({
        success: false,
        reason: "limit_daily",
        message: "لقد أرسلت ٣ طلبات اليوم. يرجى المحاولة غدًا."
      });
    }

    // جلب آخر طلب لهذا الإيميل
    const lastRequest = await JobRequest.findOne({ email }).sort({ createdAt: -1 });

    if (lastRequest?.createdAt) {
      const diffMinutes = (Date.now() - lastRequest.createdAt.getTime()) / (1000 * 60);
      if (diffMinutes < 2) {
        return res.status(429).json({
          success: false,
          reason: "rate_limit",
          message: "الرجاء الانتظار دقيقتين قبل إرسال طلب جديد."
        });
      }
    }

    // ✅ إنشاء الطلب الجديد
    const jobRequest = new JobRequest({
      ...req.body,
      ip,
      userAgent: req.headers["user-agent"],
      lastSentAt: new Date()
    });

    await jobRequest.save();

    res.status(201).json({ success: true, jobRequest });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      reason: "server_error",
      message: "خطأ داخلي في الخادم"
    });
  }
});

module.exports = router;
