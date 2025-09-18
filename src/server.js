// src/server.js
const fs = require("fs");
const path = require("path");
const http = require("http");



const app = require("./app");
const connectDB = require("./config/db");
const { PORT, NODE_ENV, UPLOAD_DIR } = require("./config/env");




(async () => {
  try {
    // 1. الاتصال بقاعدة البيانات
    await connectDB();

    // 2. التأكد من وجود مجلد الرفع
    const uploadsDir = path.join(process.cwd(), UPLOAD_DIR || "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log(`📂 أنشئ مجلد الرفع: ${uploadsDir}`);
    }

    // 3. إنشاء وتشغيل السيرفر
    const server = http.createServer(app);
    server.listen(PORT, () => {
      console.log(
        `🚀 Server running on http://localhost:${PORT} [${NODE_ENV}]`
      );
    });

    // 4. إيقاف آمن
    const shutdown = (signal) => {
      console.log(`\n🛑 ${signal} received. Shutting down...`);
      server.close(() => {
        console.log("✅ HTTP server closed.");
        process.exit(0);
      });
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
})();
