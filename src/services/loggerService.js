const fs = require('fs');
const path = require('path');

const { getDb } = require('../db/database');
const config = require('../config');

function ensureLogDir() {
  if (!fs.existsSync(config.logDir)) {
    fs.mkdirSync(config.logDir, { recursive: true });
  }
}

function log(level, module, message, userId = null, meta = null) {
  ensureLogDir();

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    userId,
    meta,
  };

  // Вывод в консоль
  console.log(
    `[${level.toUpperCase()}] [${module}] ${message}`
  );

  // Запись в БД
  try {
    getDb()
      .prepare(
        `
        INSERT INTO system_log
        (level, module, message, user_id, meta)
        VALUES (?, ?, ?, ?, ?)
      `
      )
      .run(
        level,
        module,
        message,
        userId,
        meta ? JSON.stringify(meta) : null
      );
  } catch (err) {
    console.error('Ошибка записи лога в БД:', err.message);
  }

  // Запись в файл
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