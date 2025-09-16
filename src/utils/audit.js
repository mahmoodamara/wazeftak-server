// راپر بسيط لتسجيل أحداث AuditLog باستعمال معلومات الطلب تلقائياً

const AuditLog = require('../models/AuditLog');

async function logAudit(req, {
  action,
  target,     // { model: 'Job'|'Application'|'Company'|'User', id: ObjectId }
  meta,
  diff,
  success = true,
  severity = 'info',
  tags
}) {
  const entry = {
    actorId: req.auth?.id,
    action,
    target,
    meta,
    diff,
    source: 'api',
    requestId: req.id,              // لو عندك middleware يضيفها
    sessionId: req.session?.id,     // إن وجد
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    success,
    severity,
    tags
  };
  try {
    await AuditLog.log(entry);
  } catch (e) {
    // لا تكسر الفلو بسبب تدقيق — اطبعه فقط
    // eslint-disable-next-line no-console
    console.error('AuditLog.log failed:', e.message);
  }
}

module.exports = { logAudit };
