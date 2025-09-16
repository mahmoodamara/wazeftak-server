// utils/mailer.js
const nodemailer = require('nodemailer');

const DRIVER = process.env.MAIL_DRIVER || 'smtp';
// قيم smtp الافتراضية (للـ production)
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM = process.env.MAIL_FROM || '"LocalJobs" <no-reply@localjobs.app>';

let transporterPromise;

async function buildTransporter() {
  if (DRIVER === 'ethereal') {
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  }

  if (DRIVER === 'mailpit') {
    // Mailpit/Mailhog المحلي: شغّل Mailpit على 1025 => https://github.com/axllent/mailpit
    return nodemailer.createTransport({
      host: process.env.MAILPIT_HOST || '127.0.0.1',
      port: Number(process.env.MAILPIT_PORT || 1025),
      secure: false,
    });
  }

  if (DRIVER === 'log') {
    // لا يرسل شيئًا؛ يطبع الرسالة للّوج
    return nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true,
    });
  }

  // الافتراضي: SMTP حقيقي (Production)
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
}

async function getTransporter() {
  if (!transporterPromise) transporterPromise = buildTransporter();
  return transporterPromise;
}

async function sendEmail({ to, subject, html, text }) {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: MAIL_FROM,
    to,
    subject,
    html,
    text,
  });

  // لبيئة Ethereal يرجع رابط المعاينة
  const previewUrl = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : undefined;

  if (DRIVER === 'log') {
    // اطبع محتوى الرسالة في اللوج
    // info.message يحتوي الرسالة الخام
    console.info('📧 [LOG MAIL] To:', to, 'Subject:', subject);
  }

  return { info, previewUrl };
}

module.exports = { sendEmail };
