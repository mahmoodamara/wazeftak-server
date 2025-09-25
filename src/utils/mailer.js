// utils/mailer.js
const fs = require('fs');
const nodemailer = require('nodemailer');
const { htmlToText } = require('html-to-text'); // npm i html-to-text

const DRIVER = process.env.MAIL_DRIVER || 'smtp';

// SMTP (Production)
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_NAME = process.env.SMTP_NAME || 'mailer.localjobs.app';

// From / Envelope
const MAIL_FROM = process.env.MAIL_FROM || '"LocalJobs" <notify@localjobs.app>';
const MAIL_ENVELOPE_FROM = process.env.MAIL_ENVELOPE_FROM || 'bounce@localjobs.app';
const MAIL_BOUNCE_TO = process.env.MAIL_BOUNCE_TO || 'bounce@localjobs.app';

// DKIM
const DKIM_DOMAIN = process.env.DKIM_DOMAIN;
const DKIM_SELECTOR = process.env.DKIM_SELECTOR;
const DKIM_PRIVATE_KEY_PATH = process.env.DKIM_PRIVATE_KEY_PATH;

// Transporter cache
let transporterPromise;

function buildDkimConfig() {
  if (DKIM_DOMAIN && DKIM_SELECTOR && DKIM_PRIVATE_KEY_PATH) {
    return {
      domainName: DKIM_DOMAIN,
      keySelector: DKIM_SELECTOR,
      privateKey: fs.readFileSync(DKIM_PRIVATE_KEY_PATH, 'utf8'),
      cacheDir: false, // لا كاش للـ keys
    };
  }
  return undefined;
}

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
    return nodemailer.createTransport({
      host: process.env.MAILPIT_HOST || '127.0.0.1',
      port: Number(process.env.MAILPIT_PORT || 1025),
      secure: false,
    });
  }

  if (DRIVER === 'log') {
    return nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true,
    });
  }

  // Production SMTP حقيقي مع pooling + DKIM + hostname
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    name: SMTP_NAME, // ينعكس في HELO/EHLO
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000, // نافذة 1 ثانية
    rateLimit: 10,   // 10 رسائل/ث
    auth: (SMTP_USER && SMTP_PASS) ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    dkim: buildDkimConfig(),
    tls: {
      // اسمح فقط بشهادات سليمة في الإنتاج
      rejectUnauthorized: true,
    },
  });
}

async function getTransporter() {
  if (!transporterPromise) transporterPromise = buildTransporter();
  return transporterPromise;
}

/**
 * إرسال إيميل مع أفضل ممارسات التسليم
 * @param {Object} param0
 * @param {string|string[]} param0.to
 * @param {string} param0.subject
 * @param {string} [param0.html]
 * @param {string} [param0.text]
 * @param {Object} [param0.headers]
 * @param {string} [param0.replyTo]
 * @returns
 */
async function sendEmail({ to, subject, html, text, headers = {}, replyTo }) {
  const transporter = await getTransporter();

  // توليد نص بديل تلقائياً لو لم يزوّد
  const plain = text || (html ? htmlToText(html, { wordwrap: 130 }) : undefined);

  // List-Unsubscribe (One-Click) يحسن السمعة ويقلل شكاوى السبام
  const unsubscribeUrl = `https://localjobs.app/unsubscribe/one-click/{token}`;
  const finalHeaders = {
    'List-Unsubscribe': `<mailto:unsubscribe@localjobs.app>, <${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    ...headers,
  };

  const info = await transporter.sendMail({
    from: MAIL_FROM,
    to,
    subject,
    html,
    text: plain,
    replyTo,
    // Envelope للتحكم بالـReturn-Path (البونس)
    envelope: {
      from: MAIL_ENVELOPE_FROM,
      to,
    },
    // اربط الـMessage-Id بدومينك
    messageId: `${Date.now()}.${Math.random().toString(36).slice(2)}@localjobs.app`,
    headers: finalHeaders,
  });

  // Ethereal preview (فقط لبيئة ethereal)
  const previewUrl = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : undefined;

  if (DRIVER === 'log') {
    console.info('📧 [LOG MAIL] To:', to, 'Subject:', subject);
  }

  return { info, previewUrl };
}

module.exports = { sendEmail };
