const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const allowed = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, path.join(__dirname, '..', 'uploads', 'cv')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.pdf');
    const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, name);
  }
});

const fileFilter = (req, file, cb) => {
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('INVALID_FILE_TYPE'));
  }
  cb(null, true);
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
}).single('cv'); // اسم الحقل في الواجهة يجب أن يكون "cv"
