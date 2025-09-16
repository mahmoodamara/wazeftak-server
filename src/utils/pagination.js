// تفكيك بارامترات الترقيم والفرز من query وبناء خيارات Mongoose

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePagination(query = {}) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);
  page = Number.isFinite(page) && page > 0 ? page : 1;
  limit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, MAX_LIMIT) : DEFAULT_LIMIT;
  const skip = (page - 1) * limit;

  // فرز: ?sort=createdAt&dir=desc
  const sortField = (query.sort || 'createdAt');
  const dir = String(query.dir || 'desc').toLowerCase();
  const sort = { [sortField]: dir === 'asc' ? 1 : -1 };

  return { page, limit, skip, sort };
}

async function paginateModel(Model, filter, { page, limit, skip, sort }, projection, populate) {
  const [items, total] = await Promise.all([
    Model.find(filter).select(projection || '').sort(sort).skip(skip).limit(limit).populate(populate || []).lean(),
    Model.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}

module.exports = { parsePagination, paginateModel, DEFAULT_LIMIT, MAX_LIMIT };
