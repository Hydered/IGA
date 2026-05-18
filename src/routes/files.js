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
  if (!result.success) return res.status(400).json({ error: result.error });
  res.status(201).json(result);
});

router.get('/:attachmentId/download', (req, res) => {
  const data = fileService.getFilePath(Number(req.params.attachmentId));
  if (!data) return res.status(404).json({ error: 'Файл не найден' });
  res.download(data.path, data.attachment.original_name);
});

module.exports = router;
