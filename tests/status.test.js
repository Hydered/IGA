const { describe, it } = require('node:test');
const assert = require('node:assert');
const { STATUSES, canTransition } = require('../src/constants/statuses');

describe('Переходы статусов', () => {
  it('заявитель может отправить новую на согласование', () => {
    assert.strictEqual(canTransition(STATUSES.NEW, STATUSES.PENDING, 'applicant'), true);
  });

  it('заявитель не может согласовать заявку', () => {
    assert.strictEqual(canTransition(STATUSES.PENDING, STATUSES.APPROVED, 'applicant'), false);
  });

  it('согласующий может отклонить', () => {
    assert.strictEqual(canTransition(STATUSES.PENDING, STATUSES.REJECTED, 'approver'), true);
  });

  it('исполнитель может выполнить согласованную', () => {
    assert.strictEqual(canTransition(STATUSES.APPROVED, STATUSES.COMPLETED, 'executor'), true);
  });

  it('нельзя закрыть из статуса новая', () => {
    assert.strictEqual(canTransition(STATUSES.NEW, STATUSES.CLOSED, 'admin'), false);
  });

  it('исполнитель может закрыть выполненную', () => {
    assert.strictEqual(canTransition(STATUSES.COMPLETED, STATUSES.CLOSED, 'executor'), true);
  });
});
