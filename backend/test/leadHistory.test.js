const test = require('node:test');
const assert = require('node:assert/strict');
const { buildHistory } = require('../src/services/leadHistoryService');

test('CCP-only lead history works without a local lead document', () => {
  const result = buildHistory({
    lead: null,
    audits: [{ _id: 'audit-1', eventType: 'email_sent', title: 'Introduction email sent', description: 'Sent', actorName: 'CRM User', createdAt: '2026-07-14T10:30:00Z', metadata: { recipient: 'client@example.com' } }],
    clients: [], approvals: [], notifications: []
  });
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].type, 'email_sent');
  assert.equal(result.summary.emails, 1);
});

test('local/CRM-linked lead backfills creation, status, assignment and update newest-first', () => {
  const result = buildHistory({
    lead: { _id: 'lead-1', sourceLeadId: 'crm-9', leadCode: 'ATPL-LEAD-0001', status: 'Existing Client', assignedToText: 'Asha', createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-10T00:00:00Z' },
    audits: [], clients: [], approvals: [], notifications: []
  });
  assert.ok(result.events.some((item) => item.type === 'lead_created'));
  assert.ok(result.events.some((item) => item.type === 'status_changed'));
  assert.ok(result.events.some((item) => item.type === 'assignment_changed'));
  assert.ok(new Date(result.events[0].at) >= new Date(result.events.at(-1).at));
});

test('quotation approval history includes pending and approved events', () => {
  const result = buildHistory({
    lead: null, audits: [], clients: [], notifications: [],
    approvals: [{ _id: 'approval-1', type: 'quotation', approvalStatus: 'APPROVED', createdByName: 'Sales', createdAt: '2026-07-10T09:00:00Z', actionBy: 'Manager', actionAt: '2026-07-11T09:00:00Z', remarks: 'Approved' }]
  });
  assert.deepEqual(result.events.map((item) => item.type), ['quotation_approved', 'approval_pending']);
  assert.equal(result.summary.quotations, 2);
});

test('todo and follow-up aggregation recognizes completion', () => {
  const result = buildHistory({
    lead: null, audits: [], clients: [], approvals: [],
    notifications: [
      { _id: 'todo-1', kind: 'todo', status: 'Inactive', title: 'Call client', createdAt: '2026-07-12T09:00:00Z', updatedAt: '2026-07-13T09:00:00Z', metadata: { completed: true } },
      { _id: 'follow-1', kind: 'follow-up', status: 'Active', title: 'Send details', createdAt: '2026-07-14T09:00:00Z', metadata: {} }
    ]
  });
  assert.ok(result.events.some((item) => item.type === 'todo_completed'));
  assert.ok(result.events.some((item) => item.type === 'follow_up'));
  assert.equal(result.summary.todos, 1);
  assert.equal(result.summary.followUps, 1);
});
