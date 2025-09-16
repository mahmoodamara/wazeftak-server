// مسارات رفع محلية + توليد URL ثابت عبر /static

const path = require('path');
const crypto = require('crypto');
const { UPLOAD_DIR } = require('../config/env');

function sanitizeFilename(name = 'file') {
  return String(name).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
}

/**
 * يعطيك:
 *  - diskPath: مسار على القرص داخل مجلد الرفع
 *  - relPath: المسار النسبي داخل مجلد الرفع
 *  - publicUrl: رابط يمكن تقديمه عبر app.use('/static', express.static(...))
 */
function buildLocalPaths(originalName = 'file.bin') {
  const ext = path.extname(originalName) || '.bin';
  const base = path.basename(originalName, ext);
  const safe = sanitizeFilename(base).toLowerCase();

  const stamp = Date.now().toString(36);
  const rand = crypto.randomBytes(6).toString('hex');

  const filename = `${safe}-${stamp}-${rand}${ext}`;
  const relPath = path.join(UPLOAD_DIR, filename);      // uploads/<file>
  const diskPath = path.join(process.cwd(), relPath);    // /app/uploads/<file>
  const publicUrl = `/static/${filename}`;               // GET

  return { diskPath, relPath, publicUrl, filename };
}

module.exports = { sanitizeFilename, buildLocalPaths };
