const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Lead = require('../src/models/Lead');
const controller = require('../src/controllers/leadController');
const ccpController = require('../src/controllers/ccpLeadController');
const { resolveLeadUser, userFields } = require('../src/utils/leadUserIdentity');

const krishna = { _id: new mongoose.Types.ObjectId(), name: 'Krishna', email: 'krishna@example.com', crmUserId: 'crm-k', role: 'operation', team: 'West', isActive: true };
const sonal = { _id: new mongoose.Types.ObjectId(), name: 'Sonal', email: 'sonal@example.com', crmUserId: 'crm-s', role: 'manager', team: 'North', isActive: true };

function query(value) {
  return { select() { return this; }, limit() { return this; }, lean: async () => value };
}

function fakeUsers(users) {
  return {
    findOne(filter) {
      const user = users.find((item) => {
        if (filter.isActive === true && !item.isActive) return false;
        if (filter._id && String(filter._id) !== String(item._id)) return false;
        if (filter.crmUserId && filter.crmUserId !== item.crmUserId) return false;
        if (filter.email && filter.email !== item.email) return false;
        return Boolean(filter._id || filter.crmUserId || filter.email);
      });
      return query(user || null);
    },
    find(filter) {
      const matches = users.filter((item) => (!filter.isActive || item.isActive) && filter.name.test(item.name));
      return query(matches);
    }
  };
}

test('creator identity is immutable while the last editor is server-derived updatedBy', () => {
  for (const path of ['createdBy', 'createdByName', 'createdByEmail', 'createdByCrmUserId', 'createdAt']) {
    assert.equal(Boolean(Lead.schema.path(path)?.options?.immutable), true, `${path} must be immutable`);
  }
  const created = controller._test.actorFields('createdBy', krishna);
  const updated = controller._test.actorFields('updatedBy', sonal);
  assert.equal(String(created.createdBy), String(krishna._id));
  assert.equal(String(updated.updatedBy), String(sonal._id));
  assert.equal(created.createdByName, 'Krishna');
  assert.equal(updated.updatedByName, 'Sonal');
});

test('assignment actor and closure owner remain distinct audit identities', () => {
  const at = new Date('2026-07-21T10:00:00Z');
  const assignment = controller._test.assignmentActorFields(krishna, at);
  const closure = userFields('closedBy', sonal);
  assert.equal(assignment.assignedBy, 'Krishna');
  assert.equal(String(assignment.assignedByUserId), String(krishna._id));
  assert.equal(assignment.assignedAt, at);
  assert.equal(String(closure.closedBy), String(sonal._id));
  assert.equal(closure.closedByText, 'Sonal');
});

test('CRM identity resolves by local id, CRM id, lowercase email, then unique name', async () => {
  const User = fakeUsers([krishna, sonal]);
  assert.equal(String((await resolveLeadUser({ assignedTo: sonal._id }, 'assignedTo', User)).user._id), String(sonal._id));
  assert.equal((await resolveLeadUser({ assignedToCrmUserId: 'crm-s' }, 'assignedTo', User)).user.name, 'Sonal');
  assert.equal((await resolveLeadUser({ assignedToEmail: 'SONAL@EXAMPLE.COM' }, 'assignedTo', User)).user.name, 'Sonal');
  assert.equal((await resolveLeadUser({ assignedToText: 'Sonal' }, 'assignedTo', User)).user.email, 'sonal@example.com');
});

test('invalid or inactive closedBy cannot resolve as an active closer', async () => {
  const inactive = { ...sonal, isActive: false };
  const User = fakeUsers([inactive]);
  assert.equal((await resolveLeadUser({ closedBy: sonal._id }, 'closedBy', User, { activeOnly: true })).user, null);
  assert.equal((await resolveLeadUser({ closedBy: 'not-an-object-id', closedByText: 'Missing' }, 'closedBy', User, { activeOnly: true })).user, null);
  await assert.rejects(
    ccpController._test.mapCrmUser({}, { closedBy: sonal._id }, 'closedBy', { User }, { required: true }),
    /active CCP user/
  );
});

test('API normalization exposes readable users and keeps legacy text-only records loadable', () => {
  const modern = controller._test.normalizeLeadOutput({ assignedTo: sonal, assignedToText: 'Sonal', createdBy: krishna, closedBy: sonal });
  assert.equal(modern.assignedTo.name, 'Sonal');
  assert.equal(modern.assignedTo.team, 'North');
  assert.equal(modern.createdBy.name, 'Krishna');
  assert.equal(modern.closedBy.name, 'Sonal');
  const legacy = controller._test.normalizeLeadOutput({ assignedToText: 'Legacy User', assignedToEmail: 'legacy@example.com', importedCreatedBy: 'CRM Creator' });
  assert.equal(legacy.assignedTo.name, 'Legacy User');
  assert.equal(legacy.createdBy.name, 'CRM Creator');
});
