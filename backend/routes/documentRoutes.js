const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const documentController = require('../controllers/documentController');

const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const maxMb = Number(process.env.MAX_UPLOAD_MB || 10);

const storage = multer.diskStorage({
  destination: uploadDir,
  filename(req, file, callback) {
    callback(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname).toLowerCase()}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: maxMb * 1024 * 1024 },
  fileFilter(req, file, callback) {
    if (path.extname(file.originalname).toLowerCase() !== '.pdf' || file.mimetype !== 'application/pdf') {
      const error = new Error('Only PDF files are allowed'); error.statusCode = 400; return callback(error);
    }
    callback(null, true);
  }
});

const router = express.Router();
router.post('/upload', upload.single('pdf'), documentController.upload);
router.get('/', documentController.list);
router.get('/:id', documentController.getOne);
router.delete('/:id', documentController.remove);

module.exports = router;
