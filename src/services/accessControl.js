const requestRepository = require('../repositories/requestRepository');

const GLOBAL_VIEW_ROLES = ['admin', 'executor', 'route_admin'];

function canViewRequest(request, user, approvers) {
  if (!request || !user?.id) return false;

  if (GLOBAL_VIEW_ROLES.includes(user.role)) return true;

  if (user.role === 'applicant') {
    return request.applicant_id === user.id;
  }

  if (user.role === 'approver') {
    const route = approvers || requestRepository.getApprovers(request.id);
    return route.some((a) => a.approver_id === user.id);
  }

  return false;
}

function viewDenied() {
  return { success: false, error: 'Нет доступа к этой заявке', httpStatus: 403 };
}

module.exports = { canViewRequest, viewDenied, GLOBAL_VIEW_ROLES };
