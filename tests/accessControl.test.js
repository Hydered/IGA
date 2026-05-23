const { describe, it } = require('node:test');
const assert = require('node:assert');
const { canViewRequest } = require('../src/services/accessControl');

describe('accessControl', () => {
  const request = { id: 1, applicant_id: 10 };
  const approvers = [{ approver_id: 20 }];

  it('заявитель видит только свою заявку', () => {
    assert.strictEqual(
      canViewRequest(request, { id: 10, role: 'applicant' }, approvers),
      true
    );
    assert.strictEqual(
      canViewRequest(request, { id: 99, role: 'applicant' }, approvers),
      false
    );
  });

  it('согласующий видит заявку из маршрута', () => {
    assert.strictEqual(
      canViewRequest(request, { id: 20, role: 'approver' }, approvers),
      true
    );
    assert.strictEqual(
      canViewRequest(request, { id: 99, role: 'approver' }, approvers),
      false
    );
  });

  it('admin и executor видят любую заявку', () => {
    assert.strictEqual(canViewRequest(request, { id: 1, role: 'admin' }), true);
    assert.strictEqual(canViewRequest(request, { id: 1, role: 'executor' }), true);
    assert.strictEqual(canViewRequest(request, { id: 1, role: 'route_admin' }), true);
  });
});
