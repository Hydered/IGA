const fs = require('fs');
const path = require('path');

const { getDb } = require('../db/database');
const config = require('../config');
const { getRequestContext } = require('../utils/requestContext');

function ensureLogDir() {
  if (!fs.existsSync(config.logDir)) {
    fs.mkdirSync(config.logDir, { recursive: true });
  }
}

function resolveClientMeta(meta) {
  const ctx = getRequestContext();
  const ip = meta?.ip || ctx.ip || 'unknown';
  const userAgent = meta?.userAgent || ctx.userAgent || 'unknown';
  return {
    ip: String(ip),
    userAgent: String(userAgent),
  };
}

function log(level, module, message, userId = null, meta = null) {
  ensureLogDir();

  const { ip, userAgent } = resolveClientMeta(meta);
  const metaPayload =
    meta && typeof meta === 'object'
      ? { ...meta, ip, userAgent }
      : { ip, userAgent, details: meta };

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    userId,
    ip,
    userAgent,
    meta: metaPayload,
  };

  console.log(`[${level.toUpperCase()}] [${module}] ${message} [${ip}]`);

  try {
    getDb()
      .prepare(
        `
        INSERT INTO system_log
        (level, module, message, user_id, ip_address, user_agent, meta)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        level,
        module,
        message,
        userId,
        ip,
        userAgent,
        JSON.stringify(metaPayload)
      );
  } catch (err) {
    console.error('Ошибка записи лога в БД:', err.message);
  }

  try {
    const line = JSON.stringify(entry) + '\n';
    const logFile = path.join(
      config.logDir,
      `iga-${new Date().toISOString().slice(0, 10)}.log`
    );
    fs.appendFileSync(logFile, line, 'utf8');
  } catch (err) {
    console.error('Ошибка записи лога в файл:', err.message);
  }
}

const info = (module, message, userId, meta) =>
  log('info', module, message, userId, meta);

const warn = (module, message, userId, meta) =>
  log('warn', module, message, userId, meta);

const error = (module, message, userId, meta) =>
  log('error', module, message, userId, meta);

module.exports = {
  log,
  info,
  warn,
  error,
};
