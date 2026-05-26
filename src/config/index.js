const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';
const defaultJwtSecret = 'iga-dev-secret-change-in-production';
const jwtSecret = process.env.JWT_SECRET || defaultJwtSecret;

function assertSecurityConfig() {
  if (isProduction && (!process.env.JWT_SECRET || jwtSecret === defaultJwtSecret)) {
    throw new Error(
      'В production задайте уникальный JWT_SECRET (минимум 32 случайных символа)'
    );
  }
}

module.exports = {
  isProduction,
  port: process.env.PORT || 3000,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  dbPath: process.env.IGA_DB_PATH || path.join(__dirname, '../../data/iga.db'),
  uploadsDir: path.join(__dirname, '../../uploads'),
  logDir: path.join(__dirname, '../../logs'),
  maxFileSize: 5 * 1024 * 1024,
  corsOrigin: process.env.CORS_ORIGIN || false,
  loginRateLimitWindowMs: 15 * 60 * 1000,
  loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 20,
  appPublicUrl: process.env.APP_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`,
  expiryReminderDays: (process.env.IGA_EXPIRY_REMINDER_DAYS || '7,3,1')
    .split(',')
    .map((d) => Number(d.trim()))
    .filter((d) => d > 0),
  expiryCheckIntervalMs: Number(process.env.IGA_EXPIRY_CHECK_MS) || 6 * 60 * 60 * 1000,
  smtp: {
    enabled: process.env.SMTP_ENABLED === 'true',
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'iga-noreply@company.local',
  },
  allowedMimeTypes: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  assertSecurityConfig,
};
