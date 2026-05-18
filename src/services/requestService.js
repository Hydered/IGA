const requestRepository = require('../repositories/requestRepository');
const userRepository = require('../repositories/userRepository');
const { STATUSES, PRIORITIES, canTransition } = require('../constants/statuses');
const logger = require('./loggerService');

function validateDates(data) {
  if (!data.valid_from || !data.valid_until) {
    return { success: false, error: 'Введите оба срока действия заявки' };
  }
  const start = new Date(data.valid_from);
  const end = new Date(data.valid_until);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { success: false, error: 'Введите корректные даты' };
  }
  if (start > end) {
    return { success: false, error: 'Дата окончания не может быть раньше даты начала' };
  }
  return { success: true };
}

function createRequest(user, data) {
  // Проверка: только заявители (applicant) и администраторы могут создавать заявки
  if (user.role !== 'applicant' && user.role !== 'admin') {
    return {
      success: false,
      error: `Пользователи с ролью ${user.role} не могут создавать заявки. Только заявители (applicant) и администраторы (admin).`,
    };
  }

  // По умолчанию ставим сегодняшнюю дату, если сроки не указаны (совместимость с тестами)
  const today = new Date().toISOString().slice(0, 10);
  if (!data.valid_from) data.valid_from = today;
  if (!data.valid_until) data.valid_until = today;

  const dateValidation = validateDates(data);
  if (!dateValidation.success) return dateValidation;

  if (!data.resource_id || !data.access_type_id || !data.justification?.trim()) {
    return { success: false, error: 'Заполните ресурс, тип доступа и обоснование' };
  }
  if (!PRIORITIES.includes(data.priority || 'средний')) {
    return { success: false, error: 'Некорректный приоритет' };
  }

  const request = requestRepository.create({
    applicant_id: user.id,
    department_id: data.department_id || user.department_id,
    resource_id: data.resource_id,
    access_type_id: data.access_type_id,
    justification: data.justification.trim(),
    priority: data.priority || 'средний',
    valid_from: data.valid_from,
    valid_until: data.valid_until,
    status: STATUSES.NEW,
  });

  if (data.approver_ids?.length) {
    data.approver_ids.forEach((aid, i) => {
      requestRepository.addApprover(request.id, aid, i + 1);
    });
  }

  requestRepository.addHistory(
    request.id,
    user.id,
    'создание',
    null,
    STATUSES.NEW,
    'Заявка создана'
  );

  logger.info('requests', `Создана заявка ${request.number}`, user.id);
  return { success: true, request: enrichRequest(request) };
}

function getRequest(id, user) {
  const request = requestRepository.findById(id);
  if (!request) return { success: false, error: 'Заявка не найдена' };
  const enriched = enrichRequest(request);
  enriched.can_edit_approvers = canEditApprovers(request, user);
  enriched.can_edit_request = canEditRequest(request, user);
  return { success: true, request: enriched };
}

function listRequests(user, filters) {
  const f = { ...filters };
  if (user.role === 'applicant') {
    f.applicant_id = user.id;
  } else if (user.role === 'approver') {
    if (!f.all) f.approver_id = user.id;
  }
  const requests = requestRepository.findAll(f);
  return { success: true, requests: requests.map(enrichRequest) };
}

function getApprovalComment(history, request) {
  if (request) {
    const approverWithComment = requestRepository
      .getApprovers(request.id)
      .find(
        (a) =>
          a.comment &&
          ((request.status === STATUSES.CLARIFICATION && a.decision === 'уточнение') ||
            (request.status === STATUSES.REJECTED && a.decision === 'отклонено'))
      );
    if (approverWithComment) {
      return approverWithComment.comment;
    }
  }

  if (!history?.length) return null;
  const statusComment = history.find(
    (h) =>
      h.action === 'смена статуса' &&
      (h.new_value === STATUSES.CLARIFICATION || h.new_value === STATUSES.REJECTED) &&
      h.details
  );
  if (statusComment) return statusComment.details;

  const approvalComment = history.find(
    (h) =>
      h.action === 'согласование' &&
      ['уточнение', 'отклонено'].includes(h.new_value) &&
      h.details
  );
  return approvalComment ? approvalComment.details : null;
}

function enrichRequest(request) {
  if (!request) return null;
  const history = requestRepository.getHistory(request.id);
  return {
    ...request,
    approvers: requestRepository.getApprovers(request.id),
    comments: requestRepository.getComments(request.id),
    attachments: requestRepository.getAttachments(request.id),
    history,
    approval_comment: getApprovalComment(history, request),
  };
}

function submitForApproval(requestId, user) {
  const request = requestRepository.findById(requestId);
  if (!request) return { success: false, error: 'Заявка не найдена' };

  // Проверка: только автор заявки (applicant) и администраторы могут отправлять на согласование
  if (request.applicant_id !== user.id && user.role !== 'admin') {
    return {
      success: false,
      error: `Заявку может отправить на согласование только её автор или администратор`,
    };
  }

  // Approver не может отправлять заявки
  if (user.role === 'approver') {
    return {
      success: false,
      error: 'Согласующие (approver) не могут создавать и отправлять заявки на согласование. Только заявители (applicant) и администраторы (admin).',
    };
  }

  const approvers = requestRepository.getApprovers(requestId);
  if (!approvers.length) {
    return {
      success: false,
      error:
        'Не указан маршрут согласования. Добавьте хотя бы одного согласующего и сохраните маршрут.',
    };
  }

  return changeStatus(request, STATUSES.PENDING, user, 'Отправлена на согласование');
}

function changeStatus(request, newStatus, user, details) {
  if (!canTransition(request.status, newStatus, user.role)) {
    return {
      success: false,
      error: `Переход «${request.status}» → «${newStatus}» недоступен для роли ${user.role}`,
    };
  }

  const oldStatus = request.status;
  const updated = requestRepository.updateStatus(request.id, newStatus);
  requestRepository.addHistory(
    request.id,
    user.id,
    'смена статуса',
    oldStatus,
    newStatus,
    details
  );
  logger.info('requests', `Заявка ${request.number}: ${oldStatus} → ${newStatus}`, user.id);
  return { success: true, request: enrichRequest(updated) };
}

function addComment(requestId, user, text) {
  if (!text?.trim()) return { success: false, error: 'Комментарий не может быть пустым' };
  const request = requestRepository.findById(requestId);
  if (!request) return { success: false, error: 'Заявка не найдена' };

  const comment = requestRepository.addComment(requestId, user.id, text.trim());
  requestRepository.addHistory(requestId, user.id, 'комментарий', null, null, text.trim());
  logger.info('requests', `Комментарий к заявке ${request.number}`, user.id);
  return { success: true, comment };
}

function canEditRequest(request, user) {
  if (user.role === 'admin') {
    return [STATUSES.NEW, STATUSES.CLARIFICATION, STATUSES.PENDING].includes(request.status);
  }
  if (request.applicant_id !== user.id) return false;

  if (request.status === STATUSES.NEW || request.status === STATUSES.CLARIFICATION) {
    return true;
  }

  if (request.status === STATUSES.PENDING) {
    const route = requestRepository.getApprovers(request.id);
    return route.every((a) => !a.decision);
  }

  return false;
}

const canEditApprovers = canEditRequest;

function buildRequestDiff(oldRequest, updated) {
  const changes = [];

  if (oldRequest.department_id !== updated.department_id) {
    changes.push(
      `Подразделение: ${oldRequest.department_name} → ${updated.department_name}`
    );
  }
  if (oldRequest.resource_id !== updated.resource_id) {
    changes.push(
      `Ресурс: [${oldRequest.resource_type}] ${oldRequest.resource_name} → [${updated.resource_type}] ${updated.resource_name}`
    );
  }
  if (oldRequest.access_type_id !== updated.access_type_id) {
    changes.push(
      `Тип доступа: ${oldRequest.access_type_name} → ${updated.access_type_name}`
    );
  }
  if (oldRequest.priority !== updated.priority) {
    changes.push(`Приоритет: ${oldRequest.priority} → ${updated.priority}`);
  }

  const oldValidity = `${oldRequest.valid_from || '—'} — ${oldRequest.valid_until || '—'}`;
  const newValidity = `${updated.valid_from || '—'} — ${updated.valid_until || '—'}`;
  if (oldValidity !== newValidity) {
    changes.push(`Срок действия: ${oldValidity} → ${newValidity}`);
  }

  if (oldRequest.justification !== updated.justification) {
    changes.push('Обоснование изменено');
  }

  return changes;
}

function updateRequest(requestId, data, user) {
  const request = requestRepository.findById(requestId);
  if (!request) return { success: false, error: 'Заявка не найдена' };

  // Approver не может редактировать заявки
  if (user.role === 'approver') {
    return {
      success: false,
      error:
        'Согласующие (approver) не могут редактировать заявки. Редактирование доступно только заявителям (applicant) и администраторам (admin).',
    };
  }

  if (!canEditRequest(request, user)) {
    return {
      success: false,
      error: 'Редактирование недоступно: заявка уже согласована или есть решения согласующих',
    };
  }

  // Подставляем существующие даты заявки, если в payload они не указаны
  if (!data.valid_from) data.valid_from = request.valid_from || new Date().toISOString().slice(0, 10);
  if (!data.valid_until) data.valid_until = request.valid_until || new Date().toISOString().slice(0, 10);

  const dateValidation = validateDates(data);
  if (!dateValidation.success) return dateValidation;

  if (!data.resource_id || !data.access_type_id || !data.justification?.trim()) {
    return { success: false, error: 'Заполните ресурс, тип доступа и обоснование' };
  }
  if (!PRIORITIES.includes(data.priority || 'средний')) {
    return { success: false, error: 'Некорректный приоритет' };
  }

  const updated = requestRepository.update(requestId, {
    department_id: data.department_id || request.department_id,
    resource_id: data.resource_id,
    access_type_id: data.access_type_id,
    justification: data.justification.trim(),
    priority: data.priority || 'средний',
    valid_from: data.valid_from,
    valid_until: data.valid_until,
  });

  const changes = buildRequestDiff(request, updated);
  requestRepository.addHistory(
    requestId,
    user.id,
    'изменение',
    null,
    null,
    changes.length ? changes.join('; ') : 'Обновлены данные заявки'
  );

  logger.info('requests', `Заявка ${request.number} отредактирована`, user.id);
  const enriched = enrichRequest(updated);
  enriched.can_edit_approvers = canEditApprovers(updated, user);
  enriched.can_edit_request = canEditRequest(updated, user);
  return { success: true, request: enriched };
}

function setApprovers(requestId, approverIds, user) {
  const request = requestRepository.findById(requestId);
  if (!request) return { success: false, error: 'Заявка не найдена' };

  // Approver не может изменять маршрут согласования
  if (user.role === 'approver') {
    return {
      success: false,
      error:
        'Согласующие (approver) не могут изменять маршрут согласования. Это доступно только заявителям (applicant) и администраторам (admin).',
    };
  }

  if (!canEditApprovers(request, user)) {
    return {
      success: false,
      error:
        'Маршрут нельзя изменить: заявка уже согласована или отклонена, либо есть решения согласующих',
    };
  }

  const ids = [...new Set((approverIds || []).map(Number).filter(Boolean))];
  if (!ids.length) {
    return { success: false, error: 'Выберите хотя бы одного согласующего' };
  }

  const db = require('../db/database').getDb();
  const oldRoute = requestRepository.getApprovers(requestId);
  db.prepare('DELETE FROM request_approvers WHERE request_id = ?').run(requestId);
  ids.forEach((aid, i) => requestRepository.addApprover(requestId, aid, i + 1));

  const names = ids
    .map((id) => {
      const u = db.prepare('SELECT full_name FROM users WHERE id = ?').get(id);
      return u?.full_name || id;
    })
    .join(', ');

  const details = oldRoute.length ? 'Изменён маршрут согласования' : null;
  requestRepository.addHistory(
    requestId,
    user.id,
    'маршрут',
    oldRoute.map((a) => a.approver_name).join(', ') || '—',
    names,
    details
  );

  logger.info('requests', `Маршрут заявки ${request.number} обновлён`, user.id);
  return { success: true, approvers: requestRepository.getApprovers(requestId) };
}

module.exports = {
  createRequest,
  getRequest,
  listRequests,
  submitForApproval,
  changeStatus,
  addComment,
  setApprovers,
  updateRequest,
  canEditApprovers,
  canEditRequest,
  enrichRequest,
  STATUSES,
};
