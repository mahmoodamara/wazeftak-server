// controllers/fileController.js
const fsp = require("fs/promises");
const path = require("path");
const { Types } = require("mongoose");
const File = require("../models/File");
const Application = require("../models/Application");
const Job = require("../models/Job");
const User = require("../models/User"); // ← مهم لاشتقاق companyId من المستخدم
const { created, noContent, withPagination } = require("../utils/responses");
const { parsePagination, paginateModel } = require("../utils/pagination");
const { buildLocalPaths } = require("../utils/filePaths");

/* ======================= Helpers ======================= */

const isObjectIdEqual = (a, b) => String(a) === String(b);
const sanitizeFilename = (name) =>
  String(name || "download").replace(/[/\\?%*:|"<>]/g, "_");

/** ضامن مسار آمن داخل uploads */
function resolveUploadsAbsolute(relOrStoredPath) {
  const uploadsRoot = path.resolve(process.cwd(), "uploads");
  const rel = String(relOrStoredPath || "")
    .replace(/^[\\/]+/, "")
    .replace(/^uploads[\\/]/i, ""); // لو تم تخزين prefix قديم
  const normalized = path.normalize(rel).replace(/^(\.\.[\\/])+/, "");
  return path.join(uploadsRoot, normalized);
}

/** اشتقاق companyId الحقيقي للطرف المصادَق عليه (شركة) */
async function deriveActorCompanyId(userId, jwtCompanyId) {
  // 1) الأفضل: companyId من الـJWT إن موجود
  if (jwtCompanyId && Types.ObjectId.isValid(jwtCompanyId)) {
    return new Types.ObjectId(jwtCompanyId);
  }
  // 2) من وثيقة المستخدم مباشرة (الحالة المعتادة عندك)
  const u = await User.findById(userId).select("companyId role").lean();
  if (u?.companyId && Types.ObjectId.isValid(u.companyId)) {
    return new Types.ObjectId(u.companyId);
  }
  // 3) إن لم يوجد، لا تُخَمّن شركة من قواعد بيانات أخرى—أعد null
  return null;
}

/** فحص سماح الشركة بالوصول لملف CV */
async function canCompanyAccessCv(fileId, actorCompanyId) {
  if (!actorCompanyId) return false;

  // ابحث عن الـ Application الذي يشير إلى هذا الـCV
  // (مع دعم أشكال شائعة: cvFileId أو cv._id / cv.fileId)
  const app = await Application.findOne({
    $or: [
      { cvFileId: fileId },
      { "cv._id": fileId },
      { "cv.fileId": fileId },
      // دعم الحفظ كسلسلة
      { cvFileId: String(fileId) },
      { "cv._id": String(fileId) },
      { "cv.fileId": String(fileId) },
    ],
  })
    .select("companyId jobId")
    .lean();

  if (!app) return false;

  // 1) مباشرة من الـ Application
  if (app.companyId && isObjectIdEqual(app.companyId, actorCompanyId)) {
    return true;
  }

  // 2) عبر الـ Job المرتبط
  if (app.jobId) {
    const job = await Job.findById(app.jobId).select("companyId").lean();
    if (job?.companyId && isObjectIdEqual(job.companyId, actorCompanyId)) {
      return true;
    }
  }

  return false;
}

/* ======================= رفع ملف ======================= */
/**
 * يتوقع أن الراوتر يمرر multer.single('file')
 * req.file = { originalname, mimetype, size, path (diskStorage), buffer (memoryStorage) }
 */
exports.upload = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "لم يتم رفع ملف" });

  const originalName = req.file.originalname || "file";
  const { diskPath, relPath, publicUrl, ensureDir } = buildLocalPaths(originalName);

  if (typeof ensureDir === "function") {
    await ensureDir();
  } else {
    await fsp.mkdir(path.dirname(diskPath), { recursive: true }).catch(() => {});
  }

  try {
    if (req.file.buffer) {
      await fsp.writeFile(diskPath, req.file.buffer);
    } else if (req.file.path) {
      await fsp.rename(req.file.path, diskPath);
    } else {
      return res.status(400).json({ message: "ملف غير صالح" });
    }
  } catch (e) {
    console.error("WRITE_FILE_ERR", e);
    return res.status(500).json({ message: "تعذر حفظ الملف على القرص" });
  }

  let doc;
  try {
    doc = await File.create({
      ownerId: req.auth.id,
      scope: req.body.scope || "generic",
      visibility: req.body.visibility === "public" ? "public" : "private",
      storage: "local",
      path: relPath,
      url: publicUrl,
      originalName,
      mimeType: req.file.mimetype || "application/octet-stream",
      size: req.file.size || 0,
      linkTo:
        req.body.linkToModel && req.body.linkToId
          ? { model: req.body.linkToModel, id: req.body.linkToId }
          : undefined,
    });
  } catch (e) {
    try { await fsp.unlink(diskPath); } catch (_) {}
    console.error("CREATE_FILE_DOC_ERR", e);
    return res.status(422).json({ message: e?.message || "تعذر إنشاء سجل الملف" });
  }

  return created(res, { file: doc });
};

/* ======================= قائمة ملفاتي ======================= */
exports.listMine = async (req, res) => {
  const page = parsePagination(req.query);
  const filter = { ownerId: req.auth.id };
  if (req.query.scope) filter.scope = req.query.scope;
  if (req.query.visibility) filter.visibility = req.query.visibility;

  const result = await paginateModel(File, filter, page);
  return withPagination(res, result);
};

/* ======================= حذف ملفي ======================= */
exports.remove = async (req, res) => {
  const file = await File.findOneAndDelete({ _id: req.params.id, ownerId: req.auth.id }).lean();
  if (file) {
    try {
      const absPath = resolveUploadsAbsolute(file.path);
      await fsp.unlink(absPath);
    } catch (e) {
      if (e?.code !== "ENOENT") console.warn("UNLINK_WARN", e);
    }
  }
  return noContent(res);
};

/* ======================= تنزيل ملف (يدعم CV للشركة) ======================= */
exports.download = async (req, res) => {
  try {
    const file = await File.findById(req.params.id)
      .select("ownerId visibility storage path originalName mimeType")
      .lean();

    if (!file) {
      return res.status(404).json({ code: "NOT_FOUND_DB", message: "الملف غير موجود" });
    }

    // صلاحيات
    if (file.visibility !== "public") {
      const userId = req?.auth?.id;
      const role = req?.auth?.role;
      const jwtCompanyId = req?.auth?.companyId || null;

      if (!userId) {
        return res.status(401).json({ code: "UNAUTH", message: "تسجيل الدخول مطلوب" });
      }

      const isOwner = isObjectIdEqual(file.ownerId, userId);
      const isAdmin = role === "admin";

      let isCompanyAllowed = false;
      let actorCompanyId = null;

      if (role === "company") {
        actorCompanyId = await deriveActorCompanyId(userId, jwtCompanyId);
        if (actorCompanyId) {
          isCompanyAllowed = await canCompanyAccessCv(file._id, actorCompanyId);
        }

        // لوج تشخيصي (أزِله في الإنتاج)
        console.log("🔍 Company CV ACL", {
          userId,
          role,
          jwtCompanyId,
          actorCompanyId: actorCompanyId ? String(actorCompanyId) : null,
          isOwner,
          isAdmin,
          isCompanyAllowed,
          fileId: String(file._id),
        });
      }

      if (!isOwner && !isAdmin && !(role === "company" && isCompanyAllowed)) {
        return res.status(403).json({ code: "FORBIDDEN", message: "غير مصرح لك" });
      }
    }

    if (file.storage !== "local") {
      return res.status(501).json({ code: "UNSUPPORTED", message: "التخزين غير مدعوم" });
    }

    const absPath = resolveUploadsAbsolute(file.path);
    const st = await fsp.stat(absPath).catch(() => null);
    if (!st || !st.isFile()) {
      return res.status(404).json({ code: "NOT_FOUND_FS", message: "الملف غير موجود على القرص" });
    }

    const niceName = sanitizeFilename(file.originalName || "download");
    const contentType = file.mimeType || "application/octet-stream";
    res.setHeader("Content-Type", contentType);

    return res.download(absPath, niceName, (err) => {
      if (!err) return;
      if (res.headersSent) return;
      if (err.code === "ENOENT") {
        return res.status(404).json({ code: "NOT_FOUND_FS", message: "الملف غير موجود على القرص" });
      }
      console.error("DOWNLOAD_ERR", err);
      return res.status(500).json({ code: "DL_ERR", message: "تعذّر تنزيل الملف" });
    });
  } catch (e) {
    console.error("DOWNLOAD_UNCAUGHT", e);
    return res.status(500).json({ code: "SERVER_ERR", message: "خطأ غير متوقع" });
  }
};

/* ======================= قراءة ميتاداتا ملف ======================= */
exports.readOne = async (req, res) => {
  const file = await File.findById(req.params.id).lean();
  if (!file) {
    return res.status(404).json({ code: "NOT_FOUND_DB", message: "الملف غير موجود" });
  }

  if (file.visibility !== "public") {
    const userId = req?.auth?.id;
    const role = req?.auth?.role;
    const jwtCompanyId = req?.auth?.companyId || null;

    const isOwner = userId && isObjectIdEqual(file.ownerId, userId);
    const isAdmin = role === "admin";

    let isCompanyAllowed = false;
    if (role === "company") {
      const actorCompanyId = await deriveActorCompanyId(userId, jwtCompanyId);
      if (actorCompanyId) {
        isCompanyAllowed = await canCompanyAccessCv(file._id, actorCompanyId);
      }
    }

    if (!isOwner && !isAdmin && !isCompanyAllowed) {
      return res.status(403).json({ code: "FORBIDDEN", message: "غير مصرح لك" });
    }
  }

  return res.json({ file });
};
