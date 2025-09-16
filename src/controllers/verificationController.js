const VerificationToken = require('../models/VerificationToken');
const User = require('../models/User');
const { sha256 } = require('../utils/tokens');
const { ok } = require('../utils/responses');
const { logAudit } = require('../utils/audit');

/** POST /api/verify/email/request  { email } */
exports.requestEmail = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email }).lean();
  if (user) {
    // أنشئ رمز وتخزين hash (أرسل raw بالبريد خارج الـ API)
    const { raw, hash } = require('../utils/tokens').generateRawToken(24);
    await VerificationToken.create({
      userId: user._id,
      type: 'email',
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 1000 * 60 * 30) // 30m
    });
    await logAudit(req, { action: 'request_email_verification', target: { model: 'User', id: user._id } });
    // أرسل raw عبر خدمة بريد (خارجي)
  }
  return ok(res, {}, 'إن كان البريد موجودًا ستصلك رسالة تأكيد');
};

/** POST /api/verify/email/confirm  { token } */
exports.confirmEmail = async (req, res) => {
  const { token } = req.body;
  const hash = sha256(token);
  const rec = await VerificationToken.findOne({
    tokenHash: hash,
    type: 'email',
    usedAt: { $exists: false }
  });
  if (!rec || rec.expiresAt < new Date()) {
    return res.status(400).json({ message: 'رمز غير صالح/منتهي' });
  }
  const user = await User.findByIdAndUpdate(rec.userId, { $set: { emailVerified: true } }, { new: true });
  rec.usedAt = new Date();
  await rec.save();
  await logAudit(req, { action: 'verify_email', target: { model: 'User', id: user._id } });
  return ok(res, { user }, 'تم تأكيد البريد');
};
