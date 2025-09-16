/**
 * 404 Not Found
 */
function notFound(_req, res, _next) {
  res.status(404).json({ message: 'المسار غير موجود' });
}

/**
 * تغليف الدوال async لتفادي try/catch في كل كونترولر
 * usage: router.get('/', asyncHandler(ctrl.list))
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * معالج أخطاء مركزي
 * - يطبع الخطأ في السيرفر
 * - يطبّع أخطاء Mongoose (Cast/Validation/Duplicate Key)
 */
function errorHandler(err, _req, res, _next) {
  // يمكنك تخصيص التسجيل (console/log service)
  // eslint-disable-next-line no-console
  console.error(err);

  // أخطاء صريحة تحمل status
  if (err.status && err.message) {
    return res.status(err.status).json({ message: err.message });
  }

  // Duplicate key (E11000)
  if (err?.code === 11000) {
    const fields = Object.keys(err.keyPattern || {});
    return res.status(409).json({
      message: 'قيمة مكررة في حقل فريد',
      fields
    });
  }

  // ValidationError من Mongoose
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map(e => ({
      field: e.path,
      msg: e.message
    }));
    return res.status(422).json({ message: 'خطأ في التحقق من الحقول', errors: details });
  }

  // CastError (ObjectId غير صالح)
  if (err.name === 'CastError') {
    return res.status(400).json({ message: `قيمة غير صالحة للحقل ${err.path}` });
  }

  // افتراضي
  res.status(500).json({ message: 'خطأ غير متوقع' });
}

module.exports = { notFound, errorHandler, asyncHandler };
