const { getDb } = require('../db/database');

const REQUEST_SELECT = `
  SELECT r.*,
         u.full_name as applicant_name,
         d.name as department_name,
         res.name as resource_name, res.type as resource_type,
         at.name as access_type_name
  FROM requests r
  JOIN users u ON r.applicant_id = u.id
  JOIN departments d ON r.department_id = d.id
  JOIN resources res ON r.resource_id = res.id
  JOIN access_types at ON r.access_type_id = at.id
`;

function generateNumber() {
  const year = new Date().getFullYear();
  const count = getDb()
    .prepare("SELECT COUNT(*) as c FROM requests WHERE number LIKE ?")
    .get(`IGA-${year}-%`).c;
  return `IGA-${year}-${String(count + 1).padStart(5, '0')}`;
}

function create(data) {
  const number = generateNumber();
  const result = getDb()
    .prepare(
      `INSERT INTO requests
       (number, applicant_id, department_id, resource_id, access_type_id,
        basis, justification, priority, valid_from, valid_until, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      number,
      data.applicant_id,
      data.department_id,
      data.resource_id,
      data.access_type_id,
      data.basis?.trim() || null,
      data.justification,
      data.priority,
      data.valid_from || null,
      data.valid_until || null,
      data.status || 'новая'
    );
  return findById(result.lastInsertRowid);
}

function findById(id) {
  return getDb().prepare(`${REQUEST_SELECT} WHERE r.id = ?`).get(id);
}

function findAll(filters = {}) {
  let sql = `${REQUEST_SELECT} WHERE 1=1`;
  const params = [];

  if (filters.status) {
    sql += ' AND r.status = ?';
    params.push(filters.status);
  }
  if (filters.applicant_id) {
    sql += ' AND r.applicant_id = ?';
    params.push(filters.applicant_id);
  }
  if (filters.department_id) {
    sql += ' AND r.department_id = ?';
    params.push(filters.department_id);
  }
  if (filters.resource_id) {
    sql += ' AND r.resource_id = ?';
    params.push(filters.resource_id);
  }
  if (filters.priority) {
    sql += ' AND r.priority = ?';
    params.push(filters.priority);
  }
  if (filters.search) {
    sql += ' AND (r.number LIKE ? OR r.justification LIKE ? OR r.basis LIKE ? OR u.full_name LIKE ?)';
    const term = `%${filters.search}%`;
    params.push(term, term, term, term);
  }
  if (filters.date_from) {
    sql += ' AND date(r.created_at) >= date(?)';
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    sql += ' AND date(r.created_at) <= date(?)';
    params.push(filters.date_to);
  }
  if (filters.approver_id) {
    sql += ` AND r.id IN (
      SELECT request_id FROM request_approvers WHERE approver_id = ?
    )`;
    params.push(filters.approver_id);
  }

  sql += ' ORDER BY r.created_at DESC';

  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  return getDb().prepare(sql).all(...params);
}

function updateStatus(id, status) {
  getDb()
    .prepare(
      `UPDATE requests SET status = ?, updated_at = datetime('now') WHERE id = ?`
    )
    .run(status, id);
  return findById(id);
}

function update(id, data) {
  getDb()
    .prepare(
      `UPDATE requests SET
         department_id = ?,
         resource_id = ?,
         access_type_id = ?,
         basis = ?,
         justification = ?,
         priority = ?,
         valid_from = ?,
         valid_until = ?,
         updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(
      data.department_id,
      data.resource_id,
      data.access_type_id,
      data.basis?.trim() || null,
      data.justification,
      data.priority,
      data.valid_from || null,
      data.valid_until || null,
      id
    );
  return findById(id);
}

function getApprovers(requestId) {
  return getDb()
    .prepare(
      `SELECT ra.*, u.full_name as approver_name, u.email
       FROM request_approvers ra
       JOIN users u ON ra.approver_id = u.id
       WHERE ra.request_id = ?
       ORDER BY ra.step_order`
    )
    .all(requestId);
}

function addApprover(requestId, approverId, stepOrder) {
  getDb()
    .prepare(
      `INSERT INTO request_approvers (request_id, approver_id, step_order)
       VALUES (?, ?, ?)`
    )
    .run(requestId, approverId, stepOrder);
}

function updateApproverDecision(requestId, approverId, decision, comment) {
  getDb()
    .prepare(
      `UPDATE request_approvers
       SET decision = ?, decided_at = datetime('now'), comment = ?
       WHERE request_id = ? AND approver_id = ?`
    )
    .run(decision, comment || null, requestId, approverId);
}

function getHistory(requestId) {
  return getDb()
    .prepare(
      `SELECT h.*, u.full_name as user_name
       FROM request_history h
       LEFT JOIN users u ON h.user_id = u.id
       WHERE h.request_id = ?
       ORDER BY h.created_at DESC`
    )
    .all(requestId);
}

function addHistory(requestId, userId, action, oldValue, newValue, details) {
  getDb()
    .prepare(
      `INSERT INTO request_history
       (request_id, user_id, action, old_value, new_value, details)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(requestId, userId, action, oldValue, newValue, details);
}

function getComments(requestId) {
  return getDb()
    .prepare(
      `SELECT c.*, u.full_name as user_name
       FROM comments c JOIN users u ON c.user_id = u.id
       WHERE c.request_id = ?
       ORDER BY c.created_at ASC`
    )
    .all(requestId);
}

function addComment(requestId, userId, text) {
  const result = getDb()
    .prepare('INSERT INTO comments (request_id, user_id, text) VALUES (?, ?, ?)')
    .run(requestId, userId, text);
  return getDb()
    .prepare(
      `SELECT c.*, u.full_name as user_name
       FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?`
    )
    .get(result.lastInsertRowid);
}

function getAttachments(requestId) {
  return getDb()
    .prepare(
      `SELECT a.*, u.full_name as user_name
       FROM attachments a JOIN users u ON a.user_id = u.id
       WHERE a.request_id = ? ORDER BY a.created_at DESC`
    )
    .all(requestId);
}

function addAttachment(requestId, userId, originalName, storedName, mimeType, size) {
  const result = getDb()
    .prepare(
      `INSERT INTO attachments
       (request_id, user_id, original_name, stored_name, mime_type, size)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(requestId, userId, originalName, storedName, mimeType, size);
  return getDb().prepare('SELECT * FROM attachments WHERE id = ?').get(result.lastInsertRowid);
}

function findAttachment(id) {
  return getDb().prepare('SELECT * FROM attachments WHERE id = ?').get(id);
}

function getReportStats(filters = {}) {
  const db = getDb();
  let where = 'WHERE 1=1';
  const params = [];
  if (filters.date_from) {
    where += ' AND date(created_at) >= date(?)';
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    where += ' AND date(created_at) <= date(?)';
    params.push(filters.date_to);
  }

  const byStatus = db
    .prepare(`SELECT status, COUNT(*) as count FROM requests ${where} GROUP BY status`)
    .all(...params);

  const byPriority = db
    .prepare(`SELECT priority, COUNT(*) as count FROM requests ${where} GROUP BY priority`)
    .all(...params);

  const byDepartment = db
    .prepare(
      `SELECT d.name as department, COUNT(*) as count
       FROM requests r JOIN departments d ON r.department_id = d.id
       ${where.replace('created_at', 'r.created_at')}
       GROUP BY d.name`
    )
    .all(...params);

  const total = db.prepare(`SELECT COUNT(*) as count FROM requests ${where}`).get(...params);

  const avgDays = db
    .prepare(
      `SELECT AVG(
         julianday(COALESCE(updated_at, datetime('now'))) - julianday(created_at)
       ) as avg_days FROM requests ${where} AND status IN ('выполнена', 'закрыта')`
    )
    .get(...params);

  return { total: total.count, byStatus, byPriority, byDepartment, avgProcessingDays: avgDays?.avg_days };
}

module.exports = {
  create,
  findById,
  findAll,
  updateStatus,
  update,
  getApprovers,
  addApprover,
  updateApproverDecision,
  getHistory,
  addHistory,
  getComments,
  addComment,
  getAttachments,
  addAttachment,
  findAttachment,
  getReportStats,
  generateNumber,
};
