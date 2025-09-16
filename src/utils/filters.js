// بناء فلاتر جاهزة (خاصة للوظائف) + فرز آمن

/**
 * يبني فلتر للوظائف العامة من query:
 * - يعتمد على archived:false + isApproved:true افتراضياً
 * - city, jobTypeSlug, fieldSlugs, skillSlugs, seniority
 * - q: بحث نصّي $text إن توفر فهرس، وإلا fallback إلى RegExp على العنوان
 */
function buildJobListFilter(q = {}) {
  const filter = {
    isApproved: true,
    archived: false
  };

  if (q.city) filter.city = q.city;
  if (q.jobTypeSlug) filter.jobTypeSlug = String(q.jobTypeSlug).toLowerCase();
  if (q.seniority) filter.seniority = String(q.seniority).toLowerCase();
  if (q.fieldSlug) filter.fieldSlugs = String(q.fieldSlug).toLowerCase();
  if (q.skillSlug) filter.skillSlugs = String(q.skillSlug).toLowerCase();

  if (q.companyId) filter.companyId = q.companyId; // للقوائم الخاصة

  // بحث نصّي
  if (q.q && String(q.q).trim()) {
    const text = String(q.q).trim();
    // استخدم $text لو متوفر (Mongoose/Driver يتحمل غياب الفهرس بإلقاء خطأ)
    // لذا نضيف fallback: regex على العنوان
    filter.$or = [
      { $text: { $search: text } },
      { title: new RegExp(escapeRegex(text), 'i') }
    ];
  }

  return filter;
}

/**
 * فرز آمن (whitelist) على الحقول الشائعة
 */
function safeSortQuery(q = {}) {
  const allowed = new Set(['createdAt', 'isFeatured', 'viewsCount', 'applicantsCount']);
  const field = allowed.has(q.sort) ? q.sort : 'createdAt';
  const dir = String(q.dir || 'desc').toLowerCase() === 'asc' ? 1 : -1;
  return { [field]: dir };
}

function escapeRegex(s = '') {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { buildJobListFilter, safeSortQuery, escapeRegex };
