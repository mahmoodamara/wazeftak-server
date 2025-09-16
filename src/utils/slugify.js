// توليد سلاجز لطيفة (lowercase-kebab) مع معالجة عربية/مسافات

function slugify(text, fallback = 'item') {
  const base = String(text || '')
    .normalize('NFKD')
    .replace(/[\u064B-\u065F]/g, '') // إزالة التشكيل العربي
    .replace(/[^\p{L}\p{N}]+/gu, '-') // أي شيء غير حرف/رقم → -
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return base || fallback;
}

module.exports = { slugify };
