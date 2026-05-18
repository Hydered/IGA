const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const requestRepository = require('../repositories/requestRepository');
const logger = require('./loggerService');

function ensureUploadsDir() {
  if (!fs.existsSync(config.uploadsDir)) {
    fs.mkdirSync(config.uploadsDir, { recursive: true });
  }
}

function saveFile(requestId, user, file) {
  if (!file) return { success: false, error: 'Файл не передан' };

  const request = requestRepository.findById(requestId);
  if (!request) return { success: false, error: 'Заявка не найдена' };

  if (!config.allowedMimeTypes.includes(file.mimetype)) {
    return { success: false, error: 'Недопустимый тип файла' };
  }
  if (file.size > config.maxFileSize) {
    return { success: false, error: 'Файл превышает 5 МБ' };
  }

  ensureUploadsDir();
  const ext = path.extname(file.originalname);
  const storedName = `${uuidv4()}${ext}`;
  const dest = path.join(config.uploadsDir, storedName);

  fs.renameSync(file.path, dest);

  const attachment = requestRepository.addAttachment(
    requestId,
    user.id,
    file.originalname,
    storedName,
    file.mimetype,
    file.size
  );

  requestRepository.addHistory(
    requestId,
    user.id,
    'вложение',
    null,
    file.originalname,
    `Прикреплён файл: ${file.originalname}`
  );

  logger.info('files', `Файл ${file.originalname} к заявке ${request.number}`, user.id);
  return { success: true, attachment };
}

function getFilePath(attachmentId) {
  const att = requestRepository.findAttachment(attachmentId);
  if (!att) return null;
  const filePath = path.join(config.uploadsDir, att.stored_name);
  if (!fs.existsSync(filePath)) return null;
  return { attachment: att, path: filePath };
}

module.exports = { saveFile, getFilePath, ensureUploadsDir };
