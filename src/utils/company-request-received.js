// emails/company-request-received.js

/**
 * قالب إيميل تأكيد استلام طلب من صاحب شركة
 */
module.exports = function companyRequestReceivedEmail({
  name,
  company_name,
  job_title,
  city,
}) {
  const displayName = company_name || name || "صاحب العمل";

  return `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8" />
      <title>تم استلام طلبكم – منصة وظيفتك</title>
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
              background:linear-gradient(135deg,#1d4ed8,#2563eb,#38bdf8);
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
              تم استلام طلبكم بنجاح ✅
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
              شكرًا لتقديمكم طلب توظيف عبر منصّة
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
              تم استلام طلبكم بنجاح، وسنبدأ بالعمل على توفير المرشحين الأنسب
              بأسرع وقت ممكن. 🎯
            </p>

            <!-- REQUEST SUMMARY BOX -->
            <div
              style="
                margin:14px 0 16px;
                padding:10px 12px;
                border-radius:10px;
                background:rgba(37,99,235,0.04);
                border:1px solid rgba(37,99,235,0.18);
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
                ملخّص سريع لطلبكم:
              </p>

              ${
                job_title
                  ? `<p style="margin:0 0 4px; font-size:13px; color:#374151;">
                      ▪ الوظيفة المطلوبة:
                      <strong>${job_title}</strong>
                    </p>`
                  : ""
              }
              ${
                city
                  ? `<p style="margin:0; font-size:13px; color:#374151;">
                      ▪ المدينة / المنطقة:
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
              سيقوم فريق <strong>وظيفتك</strong> بمراجعة تفاصيل الوظيفة،
              وفرز المتقدمين المناسبين، والتواصل معكم عند توفر مرشحين ملائمين.
            </p>

            <p
              style="
                margin:0 0 14px;
                color:#374151;
                font-size:13px;
                line-height:1.8;
              "
            >
              إذا رغبتم في تعديل تفاصيل الطلب أو إضافة ملاحظات إضافية،
              يمكنكم بكل بساطة الرد على هذا الإيميل، وسنقوم بمتابعة طلبكم.
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
              تحياتنا 🌟<br />
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
              تم إرسال هذا الإيميل تلقائيًا بعد تقديم طلب عبر منصّة وظيفتك.
              إذا لم تقم أنت بتقديم هذا الطلب، يمكنك تجاهل هذه الرسالة.
            </p>
          </div>
        </div>
      </div>
    </body>
  </html>
  `;
};
