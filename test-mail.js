// test-mail.js
require('dotenv').config();
const { sendEmail } = require("./src/utils/mailer");

(async () => {
  try {
    await sendEmail({
      to: "mahmoodamara21@gmail.com",
      subject: "اختبار SMTP",
      text: "مرحبا! هذا مجرد اختبار من LocalJobs 🚀",
    });
    console.log("✅ تم الإرسال بنجاح");
  } catch (err) {
    console.error("❌ فشل الإرسال:", err.message);
  }
})();
