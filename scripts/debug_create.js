process.env.IGA_DB_PATH = 'data/test-iga.db';
const { initDatabase } = require('../src/db/init');
initDatabase();
const { getDb, closeDb } = require('../src/db/database');
const db = getDb();
const applicant = db.prepare("SELECT * FROM users WHERE login = 'ivanov'").get();
const approver1 = db.prepare("SELECT * FROM users WHERE login = 'petrov'").get();
const approver2 = db.prepare("SELECT * FROM users WHERE login = 'sidorov'").get();
const requestService = require('../src/services/requestService');
const resource = db.prepare('SELECT id FROM resources LIMIT 1').get();
const accessType = db.prepare('SELECT id FROM access_types LIMIT 1').get();
const user = { id: applicant.id, role: 'applicant', department_id: applicant.department_id };
const created = requestService.createRequest(user, {
  resource_id: resource.id,
  access_type_id: accessType.id,
  justification: 'Тест',
  priority: 'средний',
  approver_ids: [approver1.id, approver2.id],
});
console.log('created', created);
closeDb();
