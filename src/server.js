// src/server.js
const fs = require("fs");
const path = require("path");
const http = require("http");

const app = require("./app");
const connectDB = require("./config/db");
const {
  PORT,
  NODE_ENV,
  UPLOAD_DIR,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_NAME,
} = require("./config/env");

const User = require("./models/User");
const bcrypt = require("bcryptjs");

/* -------------------------------------------------------------------------- */
/*                         Seed: Ensure Admin User                            */
/* -------------------------------------------------------------------------- */

async function ensureAdminUser() {
  try {
    // لو ما حطّيت env، نستعمل قيم افتراضية
    const email =
      (ADMIN_EMAIL && ADMIN_EMAIL.trim().toLowerCase()) ||
      "admin@example.com";
    const plainPassword = ADMIN_PASSWORD || "Admin123!!";
    const name = ADMIN_NAME || "Super Admin";

    console.log(`🔐 التأكد من وجود حساب أدمن (${email}) ...`);

    let user = await User.findOne({ email });

    const passwordHash = await bcrypt.hash(plainPassword, 12);

    if (user) {
      // ✅ لو موجود: نحدّثه ليكون أدمن وكمان نضبط الباسورد
      user.role = "admin";
      user.passwordHash = passwordHash;
      user.disabled = false;

      // الحقول اللي عندك في السكيمة:
      user.emailVerified = true;
      if (!user.emailVerifiedAt) {
        user.emailVerifiedAt = new Date();
      }
      if (!user.locale) user.locale = "ar";
      if (!user.profession) user.profession = "System Admin";

      await user.save();

      console.log(
        `👑 تم تحديث حساب الأدمن: ${email} (يمكنك الدخول بكلمة السر الجديدة من env أو الافتراضية).`
      );
      return;
    }

    // ✅ لو *مش موجود* ننشئه من الصفر
    user = new User({
      role: "admin",
      name,
      email,
      passwordHash,
      phone: undefined, // ممكن تحط رقم حقيقي لو بدك
      city: undefined,
      locale: "ar",
      companyId: undefined,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      profession: "System Admin",
      phoneVerified: false,
      disabled: false,
      defaultCvFileId: undefined,
    });

    await user.save();

    console.log(
      `👑 تم إنشاء حساب أدمن جديد: ${email}\n   كلمة السر: ${plainPassword}`
    );
  } catch (err) {
    console.error("❌ فشل إنشاء/تحديث حساب الأدمن:", err);
  }
}

/* -------------------------------------------------------------------------- */
/*                                Bootstrapping                               */
/* -------------------------------------------------------------------------- */

(async () => {
  try {
    // 1. الاتصال بقاعدة البيانات
    await connectDB();

    // 2. Seed: التأكد من وجود حساب أدمن
    await ensureAdminUser();

    // 3. التأكد من وجود مجلد الرفع
    const uploadsDir = path.join(process.cwd(), UPLOAD_DIR || "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log(`📂 أنشئ مجلد الرفع: ${uploadsDir}`);
    }

    // 4. إنشاء وتشغيل السيرفر
    const server = http.createServer(app);
    server.listen(PORT, () => {
      console.log(
        `🚀 Server running on http://localhost:${PORT} [${NODE_ENV}]`
      );
    });

    // 5. إيقاف آمن
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
