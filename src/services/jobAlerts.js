// services/jobAlerts.js
const User = require('../models/User');
const { sendEmail } = require('../utils/mailer');

// تفعيل/تعطيل عبر env
const JOB_ALERTS_ENABLED = process.env.JOB_ALERTS_ENABLED !== 'false';

// Normalization بسيط لعمل تطابق غير حساس لحالة الأحرف وعلامات الترقيم
const norm = (s) =>
  (s || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s\-_/]/gu, '')
    .replace(/\s+/g, ' ');

function buildJobKeywords(job) {
  const set = new Set();

  // العنوان
  if (job.title) set.add(norm(job.title));

  // وسوم ومجالات ومهارات إن توفّرت
  (Array.isArray(job.tags) ? job.tags : []).forEach((t) => set.add(norm(t)));
  (Array.isArray(job.fieldSlugs) ? job.fieldSlugs : []).forEach((t) => set.add(norm(t)));
  (Array.isArray(job.skillSlugs) ? job.skillSlugs : []).forEach((t) => set.add(norm(t)));

  // إزالة الفارغ
  set.delete('');
  return Array.from(set);
}

function buildProfessionRegexes(keywords) {
  // نستخدم ^...$ لضبط التطابق الكامل، i لعدم الحساسية لحالة الأحرف
  // مثال: profession="react developer" ↔ "React Developer"
  return keywords.map((k) => new RegExp(`^${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
}

// قالب الرسالة
function renderEmail({ user, job, companyName, jobUrl }) {
  const subject = `وظيفة جديدة تناسب مهنتك: ${job.title}`;
  const preview = `تم إضافة وظيفة "${job.title}" في ${companyName}${job.city ? ' - ' + job.city : ''}`;

  const html = `
    <div dir="rtl" style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a">
      <p>مرحباً ${user.name || ''}،</p>
      <p>تم للتو إضافة وظيفة جديدة تبدو مناسبة لمهنتك (<b>${user.profession || 'مهنتك'}</b>):</p>

      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin:12px 0;background:#fff">
        <h2 style="margin:0 0 8px;font-size:16px;color:#111827">${job.title}</h2>
        ${job.city ? `<p style="margin:0 0 6px;color:#475569">المدينة: ${job.city}</p>` : ''}
        ${job.description ? `<p style="margin:0;color:#334155;white-space:pre-wrap">${job.description.slice(0, 240)}${job.description.length > 240 ? '…' : ''}</p>` : ''}
      </div>

      <p><a href="${jobUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">عرض التفاصيل والتقديم</a></p>

      <p style="color:#64748b;font-size:12px;margin-top:24px">
        تم إرسال هذا التنبيه لأن مهنتك في الملف الشخصي تطابق هذه الوظيفة. يمكنك تعديل مهنتك أو إيقاف التنبيهات من إعدادات الحساب.
      </p>
    </div>
  `;

  const text = [
    `مرحباً ${user.name || ''},`,
    `تم إضافة وظيفة جديدة قد تناسب مهنتك (${user.profession || ''}):`,
    `${job.title}${job.city ? ' - ' + job.city : ''}`,
    '',
    `عرض الوظيفة: ${jobUrl}`,
    '',
    'تم إرسال هذا التنبيه بسبب تطابق مهنتك. يمكنك تعديل الإعدادات من حسابك.',
  ].join('\n');

  return { subject, html, text, preview };
}

async function notifyUsersForJob(job, { companyName, jobUrlBuilder }) {
  if (!JOB_ALERTS_ENABLED) return;

  const keywords = buildJobKeywords(job);
  if (keywords.length === 0) return;

  const professionRegexes = buildProfessionRegexes(keywords);

  // فلترة المستخدمين المستهدفين
  const filter = {
    role: 'job_seeker',
    disabled: { $ne: true },
    emailVerified: true,
    profession: { $in: professionRegexes },
    email: { $exists: true, $ne: null },
  };

  // Cursor + batching لتقليل الذاكرة والضغط على SMTP
  const cursor = User.find(filter)
    .select('email name locale profession')
    .lean()
    .cursor({ batchSize: 500 });

  const batch = [];
  const BATCH_SIZE = 100; // إرسال متوازي محدود

  for await (const user of cursor) {
    batch.push(user);
    if (batch.length >= BATCH_SIZE) {
      // eslint-disable-next-line no-await-in-loop
      await sendBatch(batch, job, companyName, jobUrlBuilder);
      batch.length = 0;
    }
  }
  if (batch.length) {
    await sendBatch(batch, job, companyName, jobUrlBuilder);
  }
}

async function sendBatch(users, job, companyName, jobUrlBuilder) {
  const jobUrl = jobUrlBuilder ? jobUrlBuilder(job) : `https://wazeftak.netlify.app/jobs/${job._id}`;
  await Promise.allSettled(
    users.map((u) => {
      const { subject, html, text } = renderEmail({ user: u, job, companyName, jobUrl });
      return sendEmail({ to: u.email, subject, html, text });
    })
  );
}

module.exports = { notifyUsersForJob };
