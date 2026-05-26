const config = require('../config');
const emailService = require('./emailService');
const requestRepository = require('../repositories/requestRepository');
const userRepository = require('../repositories/userRepository');
const logger = require('./loggerService');

function appLink(requestId) {
  const base = config.appPublicUrl.replace(/\/$/, '');
  return `${base}/#request/${requestId}`;
}

function collectStatusRecipients(request, newStatus) {
  const emails = new Set();
  const applicant = userRepository.findById(request.applicant_id);
  if (applicant?.email) emails.add(applicant.email);

  if (newStatus === 'согласована') {
    const executors = userRepository.findByRole('executor');
    executors.forEach((u) => {
      if (u.email) emails.add(u.email);
    });
  }

  const route = requestRepository.getApprovers(request.id);
  route.forEach((a) => {
    if (a.email) emails.add(a.email);
  });

  return [...emails];
}

async function notifyStatusChange(request, oldStatus, newStatus) {
  const recipients = collectStatusRecipients(request, newStatus);
  if (!recipients.length) return;

  const subject = `IGA: заявка ${request.number} — статус «${newStatus}»`;
  const text = [
    `Заявка: ${request.number}`,
    `Ресурс: [${request.resource_type}] ${request.resource_name}`,
    `Статус: ${oldStatus} → ${newStatus}`,
    `Срок доступа: ${request.valid_from || '—'} — ${request.valid_until || '—'}`,
    '',
    newStatus === 'выполнена'
      ? 'Доступ выдан. Заявителю необходимо подтвердить ознакомление в системе.'
      : '',
    `Открыть заявку: ${appLink(request.id)}`,
  ]
    .filter(Boolean)
    .join('\n');

  await Promise.all(
    recipients.map((to) =>
      emailService.sendMail({ to, subject, text }).catch(() => null)
    )
  );
}

async function notifyAccessExpiring(request, daysLeft) {
  const applicant = userRepository.findById(request.applicant_id);
  if (!applicant?.email) return;

  const type = `expiry_${daysLeft}d`;
  if (requestRepository.wasNotificationSent(request.id, type, applicant.email)) {
    return;
  }

  const subject = `IGA: истекает срок доступа по заявке ${request.number}`;
  const text = [
    `Заявка: ${request.number}`,
    `Ресурс: [${request.resource_type}] ${request.resource_name}`,
    `Срок доступа истекает: ${request.valid_until} (через ${daysLeft} дн.)`,
    `Текущий статус: ${request.status}`,
    '',
    `Открыть заявку: ${appLink(request.id)}`,
  ].join('\n');

  const result = await emailService.sendMail({
    to: applicant.email,
    subject,
    text,
  });

  if (result.success) {
    requestRepository.logNotification(request.id, type, applicant.email);
  }
}

async function processExpiryReminders() {
  for (const days of config.expiryReminderDays) {
    const list = requestRepository.findExpiringInDays(days);
    for (const request of list) {
      try {
        await notifyAccessExpiring(request, days);
      } catch (err) {
        logger.error(
          'notifications',
          `Ошибка напоминания по заявке ${request.number}: ${err.message}`,
          null,
          { requestId: request.id, days }
        );
      }
    }
  }
}

function startExpiryReminderScheduler() {
  const intervalMs = config.expiryCheckIntervalMs;
  processExpiryReminders().catch((err) => {
    logger.error('notifications', `Стартовая проверка сроков: ${err.message}`);
  });
  return setInterval(() => {
    processExpiryReminders().catch((err) => {
      logger.error('notifications', `Плановая проверка сроков: ${err.message}`);
    });
  }, intervalMs);
}

module.exports = {
  notifyStatusChange,
  notifyAccessExpiring,
  processExpiryReminders,
  startExpiryReminderScheduler,
};
