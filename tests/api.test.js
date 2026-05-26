const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

// Используем отдельную тестовую БД
process.env.PORT = '0';
const testDbPath = path.join(__dirname, '../data/test-iga.db');
process.env.IGA_DB_PATH = testDbPath;

const { getDb, closeDb } = require('../src/db/database');
const { initDatabase } = require('../src/db/init');
const authService = require('../src/services/authService');
const requestService = require('../src/services/requestService');
const approvalService = require('../src/services/approvalService');
const { STATUSES } = require('../src/constants/statuses');

describe('API и бизнес-логика', () => {
  let applicant, approver1, approver2, executor, admin;

  before(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    initDatabase();
    const db = getDb();

    applicant = db.prepare("SELECT * FROM users WHERE login = 'applicant'").get();
    approver1 = db.prepare("SELECT * FROM users WHERE login = 'approver'").get();
    approver2 = db.prepare("SELECT * FROM users WHERE login = 'admin'").get();
    executor = db.prepare("SELECT * FROM users WHERE login = 'executor'").get();
    admin = db.prepare("SELECT * FROM users WHERE login = 'admin'").get();
  });

  after(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('авторизация с корректными данными', () => {
    const result = authService.login('applicant', 'password123');
    assert.strictEqual(result.success, true);
    assert.ok(result.token);
    assert.strictEqual(result.user.login, 'applicant');
  });

  it('авторизация с неверным паролем', () => {
    const result = authService.login('applicant', 'wrong');
    assert.strictEqual(result.success, false);
  });

  it('создание заявки и полный цикл согласования', () => {
    const db = getDb();
    const resource = db.prepare('SELECT id FROM resources LIMIT 1').get();
    const accessType = db.prepare('SELECT id FROM access_types LIMIT 1').get();

    const user = {
      id: applicant.id,
      role: 'applicant',
      department_id: applicant.department_id,
    };

    const created = requestService.createRequest(user, {
      resource_id: resource.id,
      access_type_id: accessType.id,
      basis: 'HR-2024-001',
      justification: 'Тестовая заявка для unit-теста',
      priority: 'средний',
      approver_ids: [approver1.id, approver2.id],
    });
    assert.strictEqual(created.success, true);
    assert.ok(created.request.number.startsWith('IGA-'));

    const submitted = requestService.submitForApproval(created.request.id, user);
    assert.strictEqual(submitted.success, true);
    assert.strictEqual(submitted.request.status, STATUSES.PENDING);

    const appr1 = approvalService.processApproval(
      created.request.id,
      { id: approver1.id, role: 'approver' },
      'согласовано',
      'Ок'
    );
    assert.strictEqual(appr1.success, true);

    const appr2 = approvalService.processApproval(
      created.request.id,
      { id: approver2.id, role: 'approver' },
      'согласовано',
      'Ок'
    );
    assert.strictEqual(appr2.success, true);
    assert.strictEqual(appr2.request.status, STATUSES.APPROVED);

    const completed = approvalService.completeRequest(created.request.id, {
      id: executor.id,
      role: 'executor',
    });
    assert.strictEqual(completed.success, true);
    assert.strictEqual(completed.request.status, STATUSES.COMPLETED);

    const closedWithoutAck = approvalService.closeRequest(created.request.id, {
      id: executor.id,
      role: 'executor',
    });
    assert.strictEqual(closedWithoutAck.success, false);

    const ack = requestService.acknowledgeRequest(created.request.id, user);
    assert.strictEqual(ack.success, true);
    assert.ok(ack.request.acknowledged_at);

    const closed = approvalService.closeRequest(created.request.id, {
      id: executor.id,
      role: 'executor',
    });
    assert.strictEqual(closed.success, true);
    assert.strictEqual(closed.request.status, STATUSES.CLOSED);
  });

  it('редактирование данных заявки', () => {
    const db = getDb();
    const resource = db.prepare('SELECT id FROM resources LIMIT 1').get();
    const accessType = db.prepare('SELECT id FROM access_types LIMIT 1').get();
    const user = { id: applicant.id, role: 'applicant', department_id: applicant.department_id };

    const created = requestService.createRequest(user, {
      resource_id: resource.id,
      access_type_id: accessType.id,
      basis: 'НДА-ИТ-12',
      justification: 'Исходный текст',
      priority: 'низкий',
    });

    const updated = requestService.updateRequest(
      created.request.id,
      {
        resource_id: resource.id,
        access_type_id: accessType.id,
        basis: 'НДА-ИТ-12',
        justification: 'Обновлённый текст',
        priority: 'высокий',
      },
      user
    );
    assert.strictEqual(updated.success, true);
    assert.strictEqual(updated.request.justification, 'Обновлённый текст');
    assert.strictEqual(updated.request.priority, 'высокий');
  });

  it('редактирование маршрута согласования', () => {
    const db = getDb();
    const resource = db.prepare('SELECT id FROM resources LIMIT 1').get();
    const accessType = db.prepare('SELECT id FROM access_types LIMIT 1').get();
    const user = { id: applicant.id, role: 'applicant', department_id: applicant.department_id };

    const created = requestService.createRequest(user, {
      resource_id: resource.id,
      access_type_id: accessType.id,
      basis: 'HR-2024-002',
      justification: 'Без согласующих',
      priority: 'средний',
    });
    assert.strictEqual(created.success, true);

    let updated = requestService.setApprovers(created.request.id, [approver1.id, approver2.id], user);
    assert.strictEqual(updated.success, true);
    assert.strictEqual(updated.approvers.length, 2);

    updated = requestService.setApprovers(created.request.id, [approver2.id], user);
    assert.strictEqual(updated.success, true);
    assert.strictEqual(updated.approvers.length, 1);
  });

  it('отклонение заявки', () => {
    const db = getDb();
    const resource = db.prepare('SELECT id FROM resources LIMIT 1').get();
    const accessType = db.prepare('SELECT id FROM access_types LIMIT 1').get();

    const user = { id: applicant.id, role: 'applicant', department_id: applicant.department_id };
    const created = requestService.createRequest(user, {
      resource_id: resource.id,
      access_type_id: accessType.id,
      basis: 'НДА-ИТ-15',
      justification: 'Заявка на отклонение',
      priority: 'низкий',
      approver_ids: [approver1.id],
    });
    requestService.submitForApproval(created.request.id, user);

    const rejected = approvalService.processApproval(
      created.request.id,
      { id: approver1.id, role: 'approver' },
      'отклонено',
      'Не согласовано'
    );
    assert.strictEqual(rejected.success, true);
    assert.strictEqual(rejected.request.status, STATUSES.REJECTED);
  });
});
