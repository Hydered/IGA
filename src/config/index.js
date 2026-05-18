const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'iga-dev-secret-change-in-production',
  jwtExpiresIn: '8h',
  dbPath: process.env.IGA_DB_PATH || path.join(__dirname, '../../data/iga.db'),
  uploadsDir: path.join(__dirname, '../../uploads'),
  logDir: path.join(__dirname, '../../logs'),
  maxFileSize: 5 * 1024 * 1024,
  allowedMimeTypes: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
};
