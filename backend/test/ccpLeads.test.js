const test = require('node:test');
const assert = require('node:assert/strict');
const controller = require('../src/controllers/ccpLeadController');
const { canonicalizeBulkRow, parseImportDate, normalizeBulkDates } = require('../src/utils/bulkLeadImport');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function request(body = {}, secret) {
  return { body, get: (name) => name === 'x-ccp-secret' ? secret : undefined, params: {} };
}

test('shared secret accepts correct and rejects missing or incorrect values', () => {
  const previous = process.env.CCP_SHARED_SECRET;
  process.env.CCP_SHARED_SECRET = 'test-secret';
  let nextCalled = false;
  controller.requireSecret(request({}, 'test-secret'), response(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  for (const value of [undefined, 'wrong']) {
    const res = response();
    controller.requireSecret(request({}, value), res, () => {});
    assert.equal(res.statusCode, 401);
  }
  delete process.env.CCP_SHARED_SECRET;
  const res = response();
  controller.requireSecret(request(), res, () => {});
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, 'CCP integration credential is not configured');
  if (previous === undefined) delete process.env.CCP_SHARED_SECRET;
  else process.env.CCP_SHARED_SECRET = previous;
});

function fakeModels() {
  const records = new Map();
  let writes = 0;
  const chain = (value) => ({ select() { return this; }, lean: async () => value });
  return {
    records,
    get writes() { return writes; },
    Lead: {
      async findOneAndUpdate(filter, update) {
        const key = filter.integrationKey || `source:${String(filter.sourceLeadId).toLowerCase()}`;
        if (records.has(key)) return records.get(key);
        const doc = { _id: `ccp-${records.size + 1}`, ...update.$setOnInsert };
        records.set(key, doc);
        writes += 1;
        return doc;
      },
      findOne(query) {
        const key = query?.$or?.find((item) => item.integrationKey)?.integrationKey;
        const directKey = query?.integrationKey || (query?.sourceLeadId ? `source:${String(query.sourceLeadId).toLowerCase()}` : '');
        const value = records.get(key || directKey) || null;
        const promise = Promise.resolve(value);
        promise.sort = () => ({ select: () => ({ lean: async () => null }) });
        return promise;
      }
    },
    User: { findOne: () => chain(null) }
  };
}

test('single lead creation normalizes fields and generates stable CCP identities', async () => {
  const models = fakeModels();
  const lead = await controller._test.saveLead({ sourceLeadId: ' CRM-1 ', company: ' Acme ', emails: ' SALES@EXAMPLE.COM ' }, {}, models);
  assert.equal(lead._id, 'ccp-1');
  assert.equal(lead.company, 'Acme');
  assert.equal(lead.emails, 'sales@example.com');
  assert.equal(lead.leadCode, 'ATPL-0001');
});

test('525-row bulk-equivalent upload succeeds and retry creates no duplicates', async () => {
  const models = fakeModels();
  const legacyCategories = ['PRODUCER', 'BRAND OWNER', 'BRAND_OWNER', 'IMPORTER', 'PWP', 'RECYCLER', 'REFURBISHER', 'SIMP_PRODUCER', 'SIMP_IMPORTER_RAW', 'SIMP_MANUFACTURER_RAW', 'SIMP_SELLER'];
  const rows = Array.from({ length: 525 }, (_, index) => ({
    sourceLeadId: `excel-${index}`,
    company: `Company ${index}`,
    piboCategory: legacyCategories[index % legacyCategories.length]
  }));
  for (const row of rows) await controller._test.saveLead(row, { excel: true }, models);
  for (const row of rows) await controller._test.saveLead(row, { excel: true }, models);
  assert.equal(models.records.size, 525);
  assert.equal(models.writes, 525);
  assert.ok([...models.records.values()].every((lead) => lead.workflowStatus === 'draft'));
  assert.ok([...models.records.values()].every((lead) => controller._test.validatePayload(lead) === ''));
});

test('rows validate independently and Excel row numbers include the header row', () => {
  const rows = [
    controller._test.normalizePayload({ company: 'Good' }, { excel: true }),
    controller._test.normalizePayload({ company: '   ' }, { excel: true }),
    controller._test.normalizePayload({ company: 'Also good' }, { excel: true })
  ];
  const failures = rows.map((row, index) => ({ row: index + 2, error: controller._test.validatePayload(row) })).filter((item) => item.error);
  assert.deepEqual(failures, [{ row: 3, error: 'Company is required' }]);
});

test('PIBO categories are validated against PIBO, SIMP and PWP parents', () => {
  assert.equal(controller._test.validatePayload({ company: 'A', piboParent: 'PIBO', piboCategory: 'Producer' }), '');
  assert.equal(controller._test.validatePayload({ company: 'A', piboParent: 'SIMP', piboCategory: 'Seller' }), '');
  assert.equal(controller._test.validatePayload({ company: 'A', piboParent: 'PWP', piboCategory: 'Recycler' }), '');
  assert.equal(controller._test.validatePayload({ company: 'A', piboParent: 'PWP', piboCategory: 'PWP' }), '');
  assert.equal(controller._test.validatePayload({ company: 'A', piboParent: 'PWP', piboCategory: 'Refurbisher' }), '');
  assert.equal(controller._test.validatePayload({ company: 'A', piboParent: 'PWP', piboCategory: 'Producer' }), 'PIBO category is invalid for PWP');
});

test('all legacy PIBO category values normalize to the required hierarchy', () => {
  const expected = {
    PRODUCER: ['PIBO', 'Producer'],
    'BRAND OWNER': ['PIBO', 'Brand Owner'],
    BRAND_OWNER: ['PIBO', 'Brand Owner'],
    IMPORTER: ['PIBO', 'Importer'],
    PWP: ['PWP', 'PWP'],
    RECYCLER: ['PWP', 'Recycler'],
    REFURBISHER: ['PWP', 'Refurbisher'],
    SIMP_PRODUCER: ['SIMP', 'Producer (Small & Micro)'],
    SIMP_IMPORTER_RAW: ['SIMP', 'Importer of Raw Material'],
    SIMP_MANUFACTURER_RAW: ['SIMP', 'Manufacturer of Raw Material'],
    SIMP_SELLER: ['SIMP', 'Seller']
  };
  for (const [legacy, [parent, category]] of Object.entries(expected)) {
    const normalized = controller._test.normalizePayload({ company: 'A', piboCategory: ` ${legacy.toLowerCase()} ` }, { excel: true });
    assert.equal(normalized.piboParent, parent, legacy);
    assert.equal(normalized.piboCategory, category, legacy);
    assert.equal(controller._test.validatePayload(normalized), '', legacy);
  }
});

test('legacy category matching accepts hyphen, underscore and space variants', () => {
  for (const value of ['brand-owner', 'brand_owner', 'brand owner']) {
    assert.deepEqual(
      (({ piboParent, piboCategory }) => ({ piboParent, piboCategory }))(controller._test.normalizePayload({ company: 'A', piboCategory: value })),
      { piboParent: 'PIBO', piboCategory: 'Brand Owner' }
    );
  }
  const simp = controller._test.normalizePayload({ company: 'A', 'PIBO Category': 'simp-manufacturer-raw' });
  assert.equal(simp.piboParent, 'SIMP');
  assert.equal(simp.piboCategory, 'Manufacturer of Raw Material');
});

test('integration implementation has no CRM model or network write dependency', () => {
  const source = require('fs').readFileSync(require.resolve('../src/controllers/ccpLeadController'), 'utf8');
  assert.doesNotMatch(source, /require\([^)]*(?:crm|axios)|fetch\s*\(/i);
});

test('bulk Excel audit headers normalize across spaces, underscores and name variants', () => {
  const { data, unknown } = canonicalizeBulkRow({
    'Assigned By Name': 'Sonal More', assigned_by_email: 'SONAL@EXAMPLE.COM',
    CreatedBy: 'Krishna Yadav', 'Created By Email': 'KRISHNA@EXAMPLE.COM',
    'Assigned To': 'Asha', assigned_to_email: 'ASHA@EXAMPLE.COM', Company: 'Example Pvt Ltd'
  }, controller._test.FIELDS);
  assert.deepEqual(unknown, []);
  assert.equal(data.assignedBy, 'Sonal More');
  assert.equal(data.assignedByEmail, 'SONAL@EXAMPLE.COM');
  assert.equal(data.importedCreatedBy, 'Krishna Yadav');
  assert.equal(data.createdByEmail, 'KRISHNA@EXAMPLE.COM');
  assert.equal(data.assignedToText, 'Asha');
  assert.equal(data.assignedToEmail, 'ASHA@EXAMPLE.COM');
});

test('canonical assignedTo ObjectId does not collide with the Assigned To Excel alias', () => {
  const id = '507f1f77bcf86cd799439011';
  const canonical = canonicalizeBulkRow({ assignedToText: 'SONAL MORE', assignedTo: id }, controller._test.FIELDS).data;
  assert.equal(canonical.assignedToText, 'SONAL MORE');
  assert.equal(canonical.assignedTo, id);
  const excel = canonicalizeBulkRow({ 'Assigned To': 'SONAL MORE' }, controller._test.FIELDS).data;
  assert.equal(excel.assignedToText, 'SONAL MORE');
  assert.equal(excel.assignedTo, undefined);
});

test('bulk audit identities resolve users without replacing imported display names', async () => {
  const users = [
    { _id: '507f1f77bcf86cd799439011', name: 'Sonal More', email: 'sonal@example.com', crmUserId: 'crm-sonal' },
    { _id: '507f1f77bcf86cd799439012', name: 'Krishna Yadav', email: 'krishna@example.com', crmUserId: 'crm-krishna' }
  ];
  const query = (value) => ({ select() { return this; }, limit() { return this; }, lean: async () => value });
  const User = {
    findOne(filter) { return query(users.find((user) => (filter.email && user.email === filter.email) || (filter.crmUserId && user.crmUserId === filter.crmUserId) || (filter._id && user._id === String(filter._id))) || null); },
    find(filter) { return query(users.filter((user) => filter.name.test(user.name))); }
  };
  const data = {};
  await controller._test.applyImportedAudit(data, { assignedBy: 'Sonal More', createdByEmail: 'KRISHNA@EXAMPLE.COM', importedCreatedBy: 'Krishna from Excel' }, { User });
  assert.equal(data.assignedBy, 'Sonal More');
  assert.equal(data.assignedByName, 'Sonal More');
  assert.equal(data.assignedByEmail, 'sonal@example.com');
  assert.equal(data.assignedByUserId, users[0]._id);
  assert.equal(data.importedCreatedBy, 'Krishna from Excel');
  assert.equal(data.createdByName, 'Krishna Yadav');
  assert.equal(data.createdByEmail, 'krishna@example.com');
  assert.equal(data.createdBy, users[1]._id);
});

test('Excel, DMY and ISO dates parse while invalid values produce non-blocking warnings', () => {
  assert.match(parseImportDate(45474).value, /^2024-/);
  assert.equal(parseImportDate('21-07-2026').value, '2026-07-21T00:00:00.000Z');
  assert.equal(parseImportDate('2026-07-21').value, '2026-07-21T00:00:00.000Z');
  const row = { importedCreatedAt: 'not-a-date', assignedAt: 'also-invalid' };
  const warnings = normalizeBulkDates(row);
  assert.equal(warnings.length, 2);
  assert.equal(row.importedCreatedAt, 'not-a-date');
  assert.equal(row.assignedAt, undefined);
});
