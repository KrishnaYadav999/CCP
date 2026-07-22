const test = require('node:test');
const assert = require('node:assert/strict');
const requireCcpSharedKey = require('../src/middleware/ccpSharedKey');
const clientController = require('../src/controllers/clientController');
const User = require('../src/models/User');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function authRequest(headers = {}) {
  return { get: (name) => headers[name.toLowerCase()] };
}

test('CCP client writes accept either configured header and reject missing/wrong credentials', () => {
  const previous = {
    secret: process.env.CCP_SHARED_SECRET,
    api: process.env.CCP_API_KEY,
    sharedApi: process.env.CCP_SHARED_API_KEY
  };
  process.env.CCP_SHARED_SECRET = 'secret-one';
  process.env.CCP_API_KEY = 'secret-two';
  delete process.env.CCP_SHARED_API_KEY;

  for (const headers of [{ 'x-ccp-secret': 'secret-one' }, { 'x-ccp-api-key': 'secret-two' }]) {
    let called = false;
    requireCcpSharedKey(authRequest(headers), response(), () => { called = true; });
    assert.equal(called, true);
  }
  for (const headers of [{}, { 'x-ccp-secret': 'wrong' }]) {
    const res = response();
    requireCcpSharedKey(authRequest(headers), res, () => {});
    assert.equal(res.statusCode, 401);
    assert.equal(typeof res.body, 'object');
  }

  delete process.env.CCP_SHARED_SECRET;
  delete process.env.CCP_API_KEY;
  const unavailable = response();
  requireCcpSharedKey(authRequest(), unavailable, () => {});
  assert.equal(unavailable.statusCode, 503);
  assert.equal(unavailable.body.error, 'CCP integration credential is not configured');

  if (previous.secret === undefined) delete process.env.CCP_SHARED_SECRET; else process.env.CCP_SHARED_SECRET = previous.secret;
  if (previous.api === undefined) delete process.env.CCP_API_KEY; else process.env.CCP_API_KEY = previous.api;
  if (previous.sharedApi === undefined) delete process.env.CCP_SHARED_API_KEY; else process.env.CCP_SHARED_API_KEY = previous.sharedApi;
});

test('single Client Master identity prefers uniqueId, then ccpClientId, then business key', () => {
  const unique = clientController._test.clientIntegrationIdentity({ data: { importMeta: { uniqueId: ' CRM-C-1 ', ccpClientId: 'CCP-2' } } });
  assert.deepEqual(unique.query, { 'data.importMeta.uniqueId': 'CRM-C-1' });
  const ccp = clientController._test.clientIntegrationIdentity({ data: { importMeta: { ccpClientId: 'CCP-2' } } });
  assert.deepEqual(ccp.query, { 'data.importMeta.ccpClientId': 'CCP-2' });
  const business = clientController._test.clientIntegrationIdentity({ selectedLead: 'lead-1', data: { basic: { clientLegalName: ' Acme ' }, authorised: { email: 'A@EXAMPLE.COM' } } });
  assert.match(business.key, /^business:[a-f0-9]{64}$/);
});

test('265-row bulk import identities are stable and retry is idempotent', () => {
  const stored = new Map();
  const rows = Array.from({ length: 265 }, (_, index) => ({
    workflowStatus: 'draft',
    data: {
      basic: { clientLegalName: `Client ${index}`, onboardingYear: '2026', firstAnnualReturnYear: '2027' },
      importMeta: { uniqueId: `CRM-CLIENT-${index}` }
    }
  }));
  for (const row of [...rows, ...rows]) {
    const identity = clientController._test.clientIntegrationIdentity(row, row.data);
    if (!stored.has(identity.key)) stored.set(identity.key, row);
  }
  assert.equal(stored.size, 265);
  assert.ok([...stored.values()].every((row) => row.workflowStatus === 'draft'));
});

test('bulk rows validate independently with one-based failure numbers and partial success', () => {
  const rows = [
    { workflowStatus: 'submitted', data: { basic: { clientLegalName: 'Valid One' } } },
    { workflowStatus: 'submitted', data: { basic: {} } },
    { workflowStatus: 'draft', data: { basic: {} } }
  ];
  const failures = rows.map((row, index) => ({
    row: index + 1,
    error: row.workflowStatus === 'submitted' && !row.data?.basic?.clientLegalName ? 'Client Legal Name is required before submit' : ''
  })).filter((failure) => failure.error);
  assert.deepEqual(failures, [{ row: 2, error: 'Client Legal Name is required before submit' }]);
  assert.equal(rows.length - failures.length, 2);
});

test('normalization preserves nested sections and canonical year fields', () => {
  const data = clientController._test.applyRequestYearsToData(clientController._test.normalizeClientData({
    basic: { clientLegalName: 'Acme' }, registeredAddress: { city: 'Pune' }, communicationAddress: {},
    compliance: {}, cpcb: {}, validation: {}, otp: {}, authorised: {}, coordinating: {}, msmeRows: [], cte: {}, importMeta: {}
  }), { onboardingYear: ' 2026 ', firstAnnualReturnYear: ' 2027 ' });
  assert.equal(data.basic.onboardingYear, '2026');
  assert.equal(data.basic.firstAnnualReturnYear, '2027');
  for (const section of ['registeredAddress', 'communicationAddress', 'compliance', 'cpcb', 'validation', 'otp', 'authorised', 'coordinating', 'msmeRows', 'cte', 'importMeta']) {
    assert.ok(Object.hasOwn(data, section), section);
  }
});

test('assignment maps CRM user id first, falls back to lowercase email, and preserves creator audit identity', async () => {
  const originalFindOne = User.findOne;
  const originalFindById = User.findById;
  const calls = [];
  const chain = (value) => ({ select() { return this; }, lean: async () => value });
  User.findOne = (query) => {
    calls.push(query);
    if (query.crmUserId === 'crm-user-7') return chain({ _id: '64b000000000000000000007', name: 'CCP User', email: 'ccp@example.com', crmUserId: 'crm-user-7' });
    return chain(null);
  };
  User.findById = () => chain(null);
  try {
    const ownership = await clientController._test.enrichClientOwnership({
      adminControls: { assignedToCrmUserId: 'crm-user-7', assignedToEmail: ' CRM@EXAMPLE.COM ', assignedToText: 'CRM Name' },
      createdByCrmUserId: 'creator-crm-1', createdByEmail: ' CREATOR@EXAMPLE.COM ', createdByName: 'Creator Name'
    }, null);
    assert.deepEqual(calls[0], { crmUserId: 'crm-user-7' });
    assert.equal(String(ownership.adminControls.assignedTo), '64b000000000000000000007');
    assert.equal(ownership.adminControls.assignedToEmail, 'ccp@example.com');
    assert.equal(ownership.createdByCrmUserId, 'creator-crm-1');
    assert.equal(ownership.createdByEmail, 'creator@example.com');
    assert.equal(ownership.createdByName, 'Creator Name');
  } finally {
    User.findOne = originalFindOne;
    User.findById = originalFindById;
  }
});

test('GET normalization immediately exposes an imported Client Master with ownership and approval intact', () => {
  const imported = {
    _id: '64b000000000000000000099', workflowStatus: 'draft', createdByCrmUserId: 'creator-9',
    adminControls: { approvalStatus: 'PENDING', assignedToText: 'Unmapped CRM User' },
    data: { basic: { clientLegalName: 'Imported Client' }, importMeta: { uniqueId: 'CRM-IMPORT-9' } }
  };
  const output = clientController.normalizeClientOutput(imported);
  assert.equal(output.data.basic.clientLegalName, 'Imported Client');
  assert.equal(output.data.importMeta.uniqueId, 'CRM-IMPORT-9');
  assert.equal(output.adminControls.approvalStatus, 'PENDING');
  assert.equal(output.createdByCrmUserId, 'creator-9');
});

test('CCP client implementation has no CRM Client model persistence dependency', () => {
  const source = require('fs').readFileSync(require.resolve('../src/controllers/clientController'), 'utf8');
  assert.doesNotMatch(source, /require\([^)]*crm[^)]*client|crmClient\.(?:create|save)|CRMClient/i);
});
