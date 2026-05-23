const requestRepository = require('../repositories/requestRepository');
const requestService = require('./requestService');
const { canViewRequest, viewDenied } = require('./accessControl');
const { STATUSES } = require('../constants/statuses');
const logger = require('./loggerService');

function processApproval(requestId, user, decision, comment) {
  const request = requestRepository.findById(requestId);
  if (!request) return { success: false, error: 'Заявка не найдена', httpStatus: 404 };
  if (!canViewRequest(request, user)) return viewDenied();

  if (user.role !== 'approver' && user.role !== 'admin') {
    return {
      success: false,
      error:
        'Принимать решение на согласовании могут только согласующие (approver) и администраторы (admin)',
    };
  }

  if (request.status !== STATUSES.PENDING) {
    return { success: false, error: 'Заявка не на согласовании' };
  }

  const route = requestRepository.getApprovers(requestId);
  const myStep = route.find((a) => a.approver_id === user.id);
  if (!myStep) {
    return { success: false, error: 'Вы не в маршруте согласования этой заявки' };
  }
  if (myStep?.decision && user.role !== 'admin') {
    return { success: false, error: 'Решение уже принято на этом этапе' };
  }

  const validDecisions = ['согласовано', 'отклонено', 'уточнение'];
  if (!validDecisions.includes(decision)) {
    return { success: false, error: 'Некорректное решение' };
  }

  requestRepository.updateApproverDecision(requestId, user.id, decision, comment);

  if (decision === 'отклонено') {
    return requestService.changeStatus(
      request,
      STATUSES.REJECTED,
      user,
      comment || 'Отклонено согласующим'
    );
  }

  if (decision === 'уточнение') {
    return requestService.changeStatus(
      request,
      STATUSES.CLARIFICATION,
      user,
      comment || 'Требуется уточнение'
    );
  }

  const pending = route.filter((a) => !a.decision || a.approver_id === user.id);
  const allApproved = route.every(
    (a) => a.decision === 'согласовано' || (a.approver_id === user.id && decision === 'согласовано')
  );

  const updatedRoute = requestRepository.getApprovers(requestId);
  const stillPending = updatedRoute.some((a) => !a.decision);

  if (!stillPending) {
    const anyRejected = updatedRoute.some((a) => a.decision === 'отклонено');
    if (anyRejected) {
      return requestService.changeStatus(request, STATUSES.REJECTED, user, 'Отклонено');
    }
    logger.info('approval', `Заявка ${request.number} полностью согласована`, user.id);
    return requestService.changeStatus(
      request,
      STATUSES.APPROVED,
      user,
      'Все согласующие одобрили заявку'
    );
  }

  requestRepository.addHistory(
    requestId,
    user.id,
    'согласование',
    null,
    decision,
    comment || `Согласовано (шаг ${myStep?.step_order || '—'})`
  );

  return {
    success: true,
    request: requestService.enrichRequest(requestRepository.findById(requestId)),
    message: 'Решение зафиксировано, ожидаются другие согласующие',
  };
}

function completeRequest(requestId, user) {
  const request = requestRepository.findById(requestId);
  if (!request) return { success: false, error: 'Заявка не найдена', httpStatus: 404 };
  if (!canViewRequest(request, user)) return viewDenied();

  if (user.role !== 'executor' && user.role !== 'admin') {
    return {
      success: false,
      error: 'Только исполнители (executor) и администраторы (admin) могут завершить заявку',
    };
  }

  return requestService.changeStatus(
    request,
    STATUSES.COMPLETED,
    user,
    'Доступ предоставлен'
  );
}

function closeRequest(requestId, user) {
  const request = requestRepository.findById(requestId);
  if (!request) return { success: false, error: 'Заявка не найдена', httpStatus: 404 };
  if (!canViewRequest(request, user)) return viewDenied();

  if (user.role !== 'executor' && user.role !== 'admin') {
    return {
      success: false,
      error: 'Только исполнители (executor) и администраторы (admin) могут закрыть заявку',
    };
  }

  return requestService.changeStatus(request, STATUSES.CLOSED, user, 'Заявка закрыта');
}

function resubmitAfterClarification(requestId, user) {
  const request = requestRepository.findById(requestId);
  if (!request) return { success: false, error: 'Заявка не найдена', httpStatus: 404 };
  if (!canViewRequest(request, user)) return viewDenied();

  if (request.applicant_id !== user.id && user.role !== 'admin') {
    return {
      success: false,
      error: 'Повторно отправить заявку может только её автор или администратор',
    };
  }

  if (user.role === 'approver') {
    return {
      success: false,
      error:
        'Согласующие (approver) не могут отправлять заявки. Только заявители (applicant) и администраторы (admin).',
    };
  }

  if (request.status !== STATUSES.CLARIFICATION) {
    return { success: false, error: 'Заявка не требует уточнения' };
  }
  const approvers = requestRepository.getApprovers(requestId);
  if (!approvers.length) {
    return {
      success: false,
      error:
        'Не указан маршрут согласования. Добавьте согласующих перед повторной отправкой.',
    };
  }
  const db = require('../db/database').getDb();
  db.prepare(
    'UPDATE request_approvers SET decision = NULL, decided_at = NULL, comment = NULL WHERE request_id = ?'
  ).run(requestId);
  return requestService.changeStatus(
    request,
    STATUSES.PENDING,
    user,
    'Повторно отправлена после уточнения'
  );
}

module.exports = {
  processApproval,
  completeRequest,
  closeRequest,
  resubmitAfterClarification,
};
