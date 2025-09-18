const express = require("express");
const router = express.Router();
const Visit = require("../models/Visit");
const BUCKET_MS = 50000;

router.post("/track", async (req, res) => {
  try {
    const { visitorId, sessionId, path, referrer } = req.body;
    if (!visitorId || !sessionId || !path) {
      return res.status(400).json({ success: false, error: "missing_fields" });
    }

    const tsBucket = Math.floor(Date.now() / BUCKET_MS) * BUCKET_MS;

    // upsert لمنع التكرار داخل نفس النافذة الزمنية
    await Visit.updateOne(
      { visitorId, sessionId, path, tsBucket },
      {
        $setOnInsert: {
          visitorId,
          sessionId,
          path,
          referrer,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
          tsBucket,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    res.json({ success: true });
  } catch (err) {
    // إذا وقعت DuplicateKeyError، اعتبرها success (تم منع التكرار)
    if (err?.code === 11000) {
      return res.json({ success: true, deduped: true });
    }
    console.error(err);
    res.status(500).json({ success: false, error: "خطأ في تسجيل الزيارة" });
  }
});


// إحصائيات
router.get("/stats", async (req, res) => {
  try {
    const { from, to } = req.query;

    // فلترة الفترة الزمنية (اختياري)
    let filter = {};
    if (from && to) {
      filter.createdAt = {
        $gte: new Date(from),
        $lte: new Date(to)
      };
    }

    // ---- اليوم الحالي ----
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayFilter = { ...filter, createdAt: { $gte: startOfDay } };

    const todayVisitors = await Visit.distinct("visitorId", todayFilter);
    const todaySessions = await Visit.distinct("sessionId", todayFilter);
    const todayPageViews = await Visit.countDocuments(todayFilter);

    // ---- إجمالي (من أول يوم) ----
    const totalVisitors = await Visit.distinct("visitorId", filter);
    const totalSessions = await Visit.distinct("sessionId", filter);
    const totalPageViews = await Visit.countDocuments(filter);

    // ---- الصفحات الأكثر زيارة ----
    const topPages = await Visit.aggregate([
      { $match: filter },
      { $group: { _id: "$path", views: { $sum: 1 } } },
      { $sort: { views: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      today: {
        uniqueVisitors: todayVisitors.length,
        sessions: todaySessions.length,
        pageViews: todayPageViews
      },
      total: {
        uniqueVisitors: totalVisitors.length,
        sessions: totalSessions.length,
        pageViews: totalPageViews
      },
      topPages
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "خطأ في جلب الإحصائيات" });
  }
});

module.exports = router;
