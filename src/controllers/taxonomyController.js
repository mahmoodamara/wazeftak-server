const Taxonomy = require('../models/Taxonomy');
const { ok, created, withPagination } = require('../utils/responses');
const { parsePagination, paginateModel } = require('../utils/pagination');

exports.list = async (req, res) => {
  const page = parsePagination(req.query);
  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  if (req.query.active) filter.active = req.query.active === 'true';
  const result = await paginateModel(Taxonomy, filter, page, null, null);
  return withPagination(res, result);
};

exports.create = async (req, res) => {
  const doc = await Taxonomy.create(req.body);
  return created(res, { taxonomy: doc });
};

exports.update = async (req, res) => {
  const allowed = ['label','order','active','parentSlug','meta'];
  const set = {}; for (const k of allowed) if (k in req.body) set[k] = req.body[k];
  const doc = await Taxonomy.findByIdAndUpdate(req.params.id, { $set: set }, { new: true });
  return ok(res, { taxonomy: doc });
};

exports.remove = async (req, res) => {
  // حذف نهائي (عادي لأن التاكسونومي غير مرجعية قوية)
  await Taxonomy.findByIdAndDelete(req.params.id);
  return ok(res, {});
};
