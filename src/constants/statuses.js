const STATUSES = {
  NEW: 'новая',
  PENDING: 'на согласовании',
  CLARIFICATION: 'требуется уточнение',
  APPROVED: 'согласована',
  REJECTED: 'отклонена',
  COMPLETED: 'выполнена',
  CLOSED: 'закрыта',
};

const PRIORITIES = ['низкий', 'средний', 'высокий', 'критический'];

const ROLES = {
  APPLICANT: 'applicant',
  APPROVER: 'approver',
  ADMIN: 'admin',
  EXECUTOR: 'executor',
};

/** Допустимые переходы статусов по ролям */
const TRANSITIONS = {
  [STATUSES.NEW]: {
    [STATUSES.PENDING]: ['applicant', 'admin'],
  },
  [STATUSES.PENDING]: {
    [STATUSES.CLARIFICATION]: ['approver', 'admin'],
    [STATUSES.APPROVED]: ['approver', 'admin'],
    [STATUSES.REJECTED]: ['approver', 'admin'],
  },
  [STATUSES.CLARIFICATION]: {
    [STATUSES.PENDING]: ['applicant', 'admin'],
  },
  [STATUSES.APPROVED]: {
    [STATUSES.COMPLETED]: ['executor', 'admin'],
  },
  [STATUSES.COMPLETED]: {
    [STATUSES.CLOSED]: ['executor', 'admin'],
  },
};

function canTransition(fromStatus, toStatus, role) {
  const allowed = TRANSITIONS[fromStatus];
  if (!allowed) return false;
  const roles = allowed[toStatus];
  if (!roles) return false;
  return roles.includes(role);
}

module.exports = { STATUSES, PRIORITIES, ROLES, TRANSITIONS, canTransition };
