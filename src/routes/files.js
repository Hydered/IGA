const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const config = require('../config');
const fileService = require('../services/fileService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const upload = multer({
  dest: path.join(os.tmpdir(), 'iga-uploads'),
  limits: { fileSize: config.maxFileSize },
});

router.use(authenticate);

router.post('/:requestId', upload.single('file'), (req, res) => {
  const result = fileService.saveFile(Number(req.params.requestId), req.user, req.file);
  if (!result.success) return res.status(result.httpStatus || 400).json({ error: result.error });
  res.status(201).json(result);
});

router.get('/:attachmentId/download', (req, res) => {
  const result = fileService.getFilePath(Number(req.params.attachmentId), req.user);
  if (!result.success) return res.status(result.httpStatus || 404).json({ error: result.error });
  res.download(result.path, result.downloadName);
});

module.exports = router;
