// استجابات HTTP موحّدة + paginate helper

function ok(res, data = {}, message = 'تم') {
  return res.json({ message, data });
}

function created(res, data = {}, message = 'تم الإنشاء') {
  return res.status(201).json({ message, data });
}

function noContent(res) {
  return res.status(204).end();
}

function error(res, status = 400, message = 'خطأ في الطلب', extra = undefined) {
  const payload = { message };
  if (extra) payload.extra = extra;
  return res.status(status).json(payload);
}

/**
 * يُلف الاستجابة مع بيانات ترقيم الصفحات
 * total: إجمالي النتائج، page: الصفحة الحالية (1-based)، limit: عدد العناصر في الصفحة
 */
function withPagination(res, { items, total, page = 1, limit = 20 }, message = 'تم') {
  const pages = Math.ceil(total / Math.max(1, limit));
  return res.json({
    message,
    meta: { total, page, limit, pages },
    data: items
  });
}
function serverError(res, message = 'حدث خطأ غير متوقع') {
  return res.status(500).json({ success: false, message });
}

module.exports = { ok, created, noContent, error, withPagination,serverError };
