// emails/seeker-request-received.js

module.exports = function seekerRequestReceivedEmail({
  name,
  seeker_role,
  city,
}) {
  const displayName = name || "الصديق الكريم";

  return `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8" />
      <title>تم استلام طلبك – منصة وظيفتك</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>

    <body
      style="
        margin:0;
        padding:0;
        background-color:#f3f4f6;
        font-family:Tahoma, Arial, sans-serif;
        direction:rtl;
        text-align:right;
      "
    >
      <!-- OUTER WRAPPER -->
      <div style="max-width:640px; margin:0 auto; padding:24px 12px;">

        <!-- BRAND HEADER STRIP -->
        <div
          style="
            max-width:640px;
            margin:0 auto 10px auto;
            border-radius:16px;
            overflow:hidden;
            box-shadow:0 8px 20px rgba(15,23,42,0.06);
          "
        >
          <div
            style="
              background:linear-gradient(135deg,#059669,#10b981,#22c55e);
              padding:16px 20px;
              color:#f9fafb;
            "
          >
            <p
              style="
                margin:0 0 4px;
                font-size:11px;
                letter-spacing:0.03em;
              "
            >
              منصة وظيفتك – Wazeftak
            </p>
            <h1
              style="
                margin:0;
                font-size:18px;
                font-weight:bold;
              "
            >
              تم استلام طلبك بنجاح 🎉
            </h1>
          </div>

          <!-- MAIN CARD -->
          <div
            style="
              background:#ffffff;
              padding:22px 20px 18px;
            "
          >
            <h2
              style="
                margin:0 0 10px;
                color:#111827;
                font-size:18px;
              "
            >
              مرحبًا ${displayName} 👋
            </h2>

            <p
              style="
                margin:0 0 8px;
                color:#374151;
                font-size:14px;
                line-height:1.8;
              "
            >
              تم استلام طلبك على منصّة
              <strong>وظيفتك – Wazeftak</strong>.
            </p>

            <p
              style="
                margin:0 0 12px;
                color:#374151;
                font-size:14px;
                line-height:1.8;
              "
            >
              شكرًا لاختيارك منصتنا للبحث عن فرصة شغل تناسبك. فريقنا سيعمل على
              ربطك بالوظائف الأنسب حسب خبرتك ومكان سكنك. 🌟
            </p>

            <!-- REQUEST SUMMARY BOX -->
            <div
              style="
                margin:14px 0 16px;
                padding:10px 12px;
                border-radius:10px;
                background:rgba(16,185,129,0.06);
                border:1px solid rgba(16,185,129,0.22);
              "
            >
              <p
                style="
                  margin:0 0 6px;
                  font-size:13px;
                  color:#111827;
                  font-weight:bold;
                "
              >
                تفاصيل طلبك:
              </p>

              ${
                seeker_role
                  ? `<p style="margin:0 0 4px; font-size:13px; color:#374151;">
                      ▪ نوع الشغل المطلوب:
                      <strong>${seeker_role}</strong>
                    </p>`
                  : ""
              }

              ${
                city
                  ? `<p style="margin:0; font-size:13px; color:#374151;">
                      ▪ منطقتك:
                      <strong>${city}</strong>
                    </p>`
                  : ""
              }
            </div>

            <p
              style="
                margin:0 0 10px;
                color:#374151;
                font-size:13px;
                line-height:1.8;
              "
            >
              سنقوم بالتواصل معك فور توفر وظيفة مناسبة أو فرصة قريبة من منطقتك،
              سواء مباشرة أو من خلال المنصة.
            </p>

            <p
              style="
                margin:0 0 14px;
                color:#374151;
                font-size:13px;
                line-height:1.8;
              "
            >
              إذا رغبت في تحديث بياناتك أو تغيير نوع الشغل المطلوب، يمكنك الرد
              على هذا الإيميل وسنقوم بتحديث طلبك.
            </p>

            <!-- SIGNATURE -->
            <p
              style="
                margin:0;
                color:#111827;
                font-size:13px;
                line-height:1.7;
              "
            >
              مع تمنياتنا لك بالتوفيق والنجاح <br />
              فريق <strong>وظيفتك – Wazeftak</strong>
            </p>

            <!-- DIVIDER -->
            <hr
              style="
                margin:18px 0 10px;
                border:none;
                border-top:1px solid #e5e7eb;
              "
            />

            <!-- FOOTNOTE -->
            <p
              style="
                margin:0;
                color:#9ca3af;
                font-size:11px;
                line-height:1.7;
              "
            >
              هذا الإيميل تم إرساله تلقائيًا بعد تقديم طلبك للبحث عن شغل عبر
              منصّة وظيفتك. إذا لم تقم أنت بتعبئة هذا الطلب، يمكنك تجاهل هذه
              الرسالة.
            </p>
          </div>
        </div>
      </div>
    </body>
  </html>
  `;
};
