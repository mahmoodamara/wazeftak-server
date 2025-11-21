// utils/mailer.js
const fs = require('fs');
const nodemailer = require('nodemailer');
const { htmlToText } = require('html-to-text');

const DRIVER = process.env.MAIL_DRIVER || 'auto'; // ← auto بدلاً من smtp

// SMTP (Production)
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false') === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_NAME = process.env.SMTP_NAME || 'mailer.localjobs.app';

// From / Envelope
const MAIL_FROM = process.env.MAIL_FROM || '"LocalJobs" <notify@localjobs.app>';
const MAIL_ENVELOPE_FROM = process.env.MAIL_ENVELOPE_FROM || 'bounce@localjobs.app';
const MAIL_BOUNCE_TO = process.env.MAIL_BOUNCE_TO || 'bounce@localjobs.app';

// DKIM (اختياري)
const DKIM_DOMAIN = process.env.DKIM_DOMAIN;
const DKIM_SELECTOR = process.env.DKIM_SELECTOR;
const DKIM_PRIVATE_KEY_PATH = process.env.DKIM_PRIVATE_KEY_PATH;

// Transporter cache
let transporterPromise;

function safeRead(path) {
  try { return fs.readFileSync(path, 'utf8'); } catch { return undefined; }
}
function buildDkimConfig() {
  if (DKIM_DOMAIN && DKIM_SELECTOR && DKIM_PRIVATE_KEY_PATH) {
    const key = safeRead(DKIM_PRIVATE_KEY_PATH);
    if (key) {
      return {
        domainName: DKIM_DOMAIN,
        keySelector: DKIM_SELECTOR,
        privateKey: key,
        cacheDir: false,
      };
    }
    console.warn('[MAIL] DKIM key file not found, skipping DKIM.');
  }
  return undefined;
}

async function buildTransporter() {
  const inProd = process.env.NODE_ENV === 'production';
  const driver = (DRIVER || 'auto').toLowerCase();

  // 1) auto: اختر ethereal في التطوير عند غياب SMTP، وإلا smtp
  if (driver === 'auto') {
    if (!inProd && !SMTP_HOST) return createEthereal();
    return createSmtp(); // يُتوقع وجود ENV صحيحة
  }

  // 2) سواقات محددة صراحة
  if (driver === 'ethereal') return createEthereal();
  if (driver === 'mailpit') return createMailpit();
  if (driver === 'log')     return createLog();
  if (driver === 'smtp')    return createSmtp();

  console.warn(`[MAIL] Unknown MAIL_DRIVER=${DRIVER}, falling back to auto`);
  if (!inProd && !SMTP_HOST) return createEthereal();
  return createSmtp();
}

async function createEthereal() {
  const test = await nodemailer.createTestAccount();
  const t = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: test.user, pass: test.pass },
  });
  return t;
}

function createMailpit() {
  return nodemailer.createTransport({
    host: process.env.MAILPIT_HOST || '127.0.0.1',
    port: Number(process.env.MAILPIT_PORT || 1025),
    secure: false,
  });
}

function createLog() {
  return nodemailer.createTransport({
    streamTransport: true,
    newline: 'unix',
    buffer: true,
  });
}

function assertSmtpEnv() {
  if (!SMTP_HOST) throw new Error('SMTP_NOT_CONFIGURED: SMTP_HOST missing');
  if ((SMTP_USER || SMTP_PASS) && !(SMTP_USER && SMTP_PASS)) {
    throw new Error('SMTP_NOT_CONFIGURED: both SMTP_USER and SMTP_PASS are required when one is set');
  }
}

function createSmtp() {
  assertSmtpEnv();
  const dkim = buildDkimConfig();
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    name: SMTP_NAME,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 10,
    auth: (SMTP_USER && SMTP_PASS) ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    dkim,
    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  });
  return transport;
}

async function getTransporter() {
  if (!transporterPromise) transporterPromise = buildTransporter();
  return transporterPromise;
}

/**
 * إرسال بريد
 */
async function sendEmail({ to, subject, html, text, headers = {}, replyTo }) {
  const transporter = await getTransporter();

  // جرّب verify في التطوير لتشخيص فوري
  try {
    if (process.env.NODE_ENV !== 'production') {
      await transporter.verify();
    }
  } catch (e) {
    console.error('✖ transporter.verify failed:', e.message || e);
    throw e;
  }

  const plain = text || (html ? htmlToText(html, { wordwrap: 130 }) : undefined);

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
    envelope: { from: MAIL_ENVELOPE_FROM, to },
    messageId: `${Date.now()}.${Math.random().toString(36).slice(2)}@localjobs.app`,
    headers: finalHeaders,
  });

  const previewUrl = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : undefined;

  // لو DRIVER=log اطبع المحتوى ليساعدك
  if (DRIVER === 'log') {
    console.info('📧 [LOG MAIL] To:', to, 'Subject:', subject);
    if (info && info.message) console.info('— Raw:\n' + info.message.toString());
  }

  return { info, previewUrl };
}

module.exports = { sendEmail };
