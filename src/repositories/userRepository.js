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

module.exports = { findByLogin, findById, findApprovers };
