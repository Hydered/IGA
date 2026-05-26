const { getDb } = require('../db/database');

function findByLogin(login) {
  return getDb()
    .prepare(
      `SELECT u.*, d.name as department_name
       FROM users u LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.login = ?`
    )
    .get(login);
}

function findById(id) {
  return getDb()
    .prepare(
      `SELECT u.id, u.login, u.full_name, u.department_id, u.role, u.email, u.can_view_reports,
              d.name as department_name
       FROM users u LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = ?`
    )
    .get(id);
}

function findApprovers() {
  return getDb()
    .prepare(
      `SELECT u.id, u.full_name, u.role, d.name as department_name
       FROM users u LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.role IN ('approver', 'admin')`
    )
    .all();
}

function findByRole(role) {
  return getDb()
    .prepare(
      `SELECT u.id, u.login, u.full_name, u.email, u.role
       FROM users u WHERE u.role = ?`
    )
    .all(role);
}

function countEligibleApprovers(ids) {
  if (!ids?.length) return 0;
  const placeholders = ids.map(() => '?').join(',');
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) as c FROM users
       WHERE id IN (${placeholders}) AND role IN ('approver', 'admin')`
    )
    .get(...ids);
  return row.c;
}

module.exports = {
  findByLogin,
  findById,
  findApprovers,
  findByRole,
  countEligibleApprovers,
};
