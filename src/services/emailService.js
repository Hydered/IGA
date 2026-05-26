const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const config = require('../config');
const logger = require('./loggerService');

let transporter = null;

function ensureLogDir() {
  if (!fs.existsSync(config.logDir)) {
    fs.mkdirSync(config.logDir, { recursive: true });
  }
}

function getTransporter() {
  if (!config.smtp.enabled) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user
        ? { user: config.smtp.user, pass: config.smtp.pass }
        : undefined,
    });
  }
  return transporter;
}

function writeToMailLog(entry) {
  ensureLogDir();
  const file = path.join(config.logDir, `emails-${new Date().toISOString().slice(0, 10)}.log`);
  fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, 'utf8');
}

async function sendMail({ to, subject, text, html }) {
  if (!to) {
    return { success: false, error: 'Не указан получатель' };
  }

  const payload = {
    to,
    subject,
    text,
    html: html || text,
    from: config.smtp.from,
  };

  if (!config.smtp.enabled) {
    writeToMailLog({ ...payload, mode: 'dev-log', sentAt: new Date().toISOString() });
    logger.info('email', `Письмо (dev): «${subject}» → ${to}`, null, { subject, to });
    return { success: true, mode: 'dev-log' };
  }

  try {
    const transport = getTransporter();
    await transport.sendMail(payload);
    logger.info('email', `Письмо отправлено: «${subject}» → ${to}`, null, { subject, to });
    return { success: true, mode: 'smtp' };
  } catch (err) {
    logger.error('email', `Ошибка отправки: ${err.message}`, null, { subject, to });
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendMail,
};
