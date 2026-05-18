const { getDb } = require('../db/database');

function getDepartments() {
  return getDb().prepare('SELECT * FROM departments ORDER BY name').all();
}

function getResources(activeOnly = true) {
  let sql = 'SELECT r.*, d.name as owner_department FROM resources r LEFT JOIN departments d ON r.owner_department_id = d.id';
  if (activeOnly) sql += ' WHERE r.is_active = 1';
  return getDb().prepare(sql + ' ORDER BY r.name').all();
}

function getAccessTypes() {
  return getDb().prepare('SELECT * FROM access_types ORDER BY name').all();
}

module.exports = { getDepartments, getResources, getAccessTypes };
