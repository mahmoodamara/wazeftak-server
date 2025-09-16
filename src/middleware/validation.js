const { validationResult, matchedData } = require('express-validator');

/**
 * جمع أخطاء express-validator وإرجاع 422 مع تفاصيل الحقول
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(422).json({
    message: 'أخطاء في التحقق من المدخلات',
    errors: errors.array().map(e => ({
      field: e.path,
      msg: e.msg,
      value: e.value
    }))
  });
}

/**
 * مهذِّب بسيط: يستخرج الحقول المتوافقة مع الفاليديتورز + trim strings
 * يستخدمه الراوتر بعد تعريف الـ body/param validators
 */
function sanitize(req, _res, next) {
  const data = matchedData(req, { locations: ['body', 'params', 'query'], includeOptionals: true });
  // trim لكل القيم النصية
  for (const k of Object.keys(data)) {
    if (typeof data[k] === 'string') data[k] = data[k].trim();
  }
  req.cleaned = data;
  next();
}

module.exports = { validate, sanitize };
