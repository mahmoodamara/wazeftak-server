const mongoose = require('mongoose');

const SEVERITIES = ['info', 'warning', 'error', 'security'];
const SOURCES = ['api', 'web', 'admin', 'cli', 'job'];

const auditLogSchema = new mongoose.Schema({
  actorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  action:    { type: String, required: true, trim: true, lowercase: true, index: true },
  target: {
    model: { type: String, enum: ['Job','Application','Company','User'], required: true },
    id:    { type: mongoose.Schema.Types.ObjectId, required: true }
  },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', index: true },
  jobId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Job', index: true },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

  source:     { type: String, enum: SOURCES, default: 'api', index: true },
  requestId:  { type: String, trim: true, maxlength: 100 },
  sessionId:  { type: String, trim: true, maxlength: 100 },

  ip:         { type: String, trim: true, maxlength: 64 },
  userAgent:  { type: String, trim: true, maxlength: 512 },

  success:    { type: Boolean, default: true, index: true },
  reason:     { type: String, trim: true, maxlength: 300 },
  severity:   { type: String, enum: SEVERITIES, default: 'info', index: true },

  meta:       { type: mongoose.Schema.Types.Mixed },
  diff: {
    before:   { type: mongoose.Schema.Types.Mixed },
    after:    { type: mongoose.Schema.Types.Mixed }
  },
  tags:       [{ type: String, trim: true, lowercase: true, maxlength: 40 }]
}, { timestamps: { createdAt: true, updatedAt: false }, minimize: true });

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ 'target.model': 1, 'target.id': 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ source: 1, success: 1, severity: 1, createdAt: -1 });

auditLogSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => { ret.id = ret._id; delete ret._id; return ret; }
});

auditLogSchema.pre('validate', function(next) {
  if (this.action) this.action = String(this.action).toLowerCase().trim();
  next();
});

auditLogSchema.statics.log = async function(entry = {}) {
  const AuditLog = this;
  const { actorId, action, target, meta, diff, source='api', requestId, sessionId, ip, userAgent, success=true, reason, severity='info', tags } = entry;
  if (!action) throw new Error('action مطلوب');
  if (!target?.model || !target?.id) throw new Error('target.model و target.id مطلوبان');
  const doc = { actorId, action, target: { model: target.model, id: target.id }, meta, diff, source, requestId, sessionId, ip, userAgent, success, reason, severity, tags };
  try {
    if (target.model === 'Job') {
      doc.jobId = target.id;
      const job = await mongoose.model('Job').findById(target.id).select('companyId').lean();
      if (job?.companyId) doc.companyId = job.companyId;
    } else if (target.model === 'Application') {
      const app = await mongoose.model('Application').findById(target.id).select('companyId jobId userId').lean();
      if (app?.companyId) doc.companyId = app.companyId;
      if (app?.jobId)     doc.jobId     = app.jobId;
      if (app?.userId)    doc.userId    = app.userId;
    } else if (target.model === 'Company') {
      doc.companyId = target.id;
    } else if (target.model === 'User') {
      doc.userId = target.id;
    }
  } catch (_) { /* ignore enrich errors */ }
  return AuditLog.create(doc);
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
