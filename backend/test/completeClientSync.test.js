const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const strictCcpApiKey = require('../src/middleware/strictCcpApiKey');
const syncController = require('../src/controllers/clientSyncController');
const Client = require('../src/models/Client');
const { containsBase64, deepMerge, identitiesFromClient } = require('../src/utils/clientSync');

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('dedicated synchronization key rejects missing and incorrect credentials', () => {
  const previous = process.env.CCP_SHARED_API_KEY;
  process.env.CCP_SHARED_API_KEY = 'server-only-key';
  for (const supplied of [undefined, 'incorrect']) {
    const res = response(); let called = false;
    strictCcpApiKey({ get: () => supplied }, res, () => { called = true; });
    assert.equal(res.statusCode, 401); assert.equal(called, false);
  }
  if (previous === undefined) delete process.env.CCP_SHARED_API_KEY; else process.env.CCP_SHARED_API_KEY = previous;
});

test('a client synchronization batch larger than ten is rejected before persistence', async () => {
  const res = response();
  await syncController.bulkUpsert({ body: { clients: Array.from({ length: 11 }, () => ({})), expectedTotal: 265, syncRunId: 'd9428888-122b-4d15-9f55-3c2d943c9abc' } }, res);
  assert.equal(res.statusCode, 400); assert.match(res.body.error, /maximum of 10/i);
});

test('CRM Unique ID is the primary normalized identity and display value is preserved', () => {
  const identity = identitiesFromClient({ data: { importMeta: { uniqueId: ' ATPL-0286 ', ccpClientId: 'CCP-1', crmClientId: 'CRM-1', leadNumber: 'L-1' } } });
  assert.equal(identity.primary, 'atpl-0286');
  assert.equal(identity.primaryDisplay, 'ATPL-0286');
  assert.equal(identity.normalized.crmClientId, 'crm-1');
});

test('meaningful deep merge preserves populated CCP values, zero and false', () => {
  const merged = deepMerge({ name: 'Existing', count: 9, enabled: true, nested: { note: 'keep' } }, { name: '', count: 0, enabled: false, nested: {}, ignored: null });
  assert.deepEqual(merged, { name: 'Existing', count: 0, enabled: false, nested: { note: 'keep' } });
});

test('all Client Master sections and multiple annual services survive merge', () => {
  const sections = { basic: { name: 'Acme' }, registeredAddress: { state: 'Gujarat' }, communicationAddress: { city: 'Surat' }, documents: [{ name: 'doc' }], validationDocuments: [{ name: 'legacy' }], msmeRows: [{ year: '2025' }], cteDetails: [{ location: 'A' }], ctoDetails: [{ location: 'A' }], cpcb: { loginId: 'x' }, cpcbScreenshots: [{ name: 'screen' }], authorised: { name: 'A' }, coordinatingPerson: { name: 'B' }, otp: { mobile: '1' }, annualReturn: { filings: { '2025-26': { draft: { purchaseOrderConfirmation: { rows: [{ service: ['CONSULTANCY FEE', 'PLANT AUDIT'] }] } } } } } };
  assert.deepEqual(deepMerge({}, sections), sections);
});

test('Cloudinary file metadata persists and duplicate files are deduplicated', () => {
  const file = { name: 'proof.pdf', url: 'http://res.cloudinary.com/a', secureUrl: 'https://res.cloudinary.com/a', publicId: 'ccp/proof', storageKey: 'ccp/proof', resourceType: 'raw', type: 'application/pdf', size: 123 };
  const result = deepMerge({ files: [file] }, { files: [{ ...file }] });
  assert.equal(result.files.length, 1); assert.deepEqual(result.files[0], file);
});

test('base64 media is rejected while Cloudinary URLs are accepted', () => {
  assert.equal(containsBase64({ file: 'data:image/png;base64,AAAA' }), true);
  assert.equal(containsBase64({ secureUrl: 'https://res.cloudinary.com/demo/image/upload/a.png' }), false);
});

test('265 CRM identities remain exactly 265 across repeated synchronization batches', () => {
  const stored = new Map();
  const rows = Array.from({ length: 265 }, (_, i) => ({ data: { importMeta: { uniqueId: `ATPL-${String(i + 1).padStart(4, '0')}` } } }));
  for (const row of [...rows, ...rows]) { const id = identitiesFromClient(row); stored.set(id.primary, deepMerge(stored.get(id.primary) || {}, row)); }
  assert.equal(stored.size, 265);
});

test('reconciliation query excludes only discontinued and suspended records', () => {
  const query = syncController._test.liveClientQuery();
  const source = query.$nor.map((item) => item['adminControls.visibilityStatus'].source).join(' ');
  assert.match(source, /discontinued/i); assert.match(source, /suspended/i);
  assert.doesNotMatch(source, /annual|cpcb|approval|processing/i);
});

test('database indexes cover stable synchronization aliases', () => {
  const indexes = Client.schema.indexes().map(([keys, options]) => ({ keys, options }));
  assert.ok(indexes.some((item) => item.keys['syncIdentity.normalizedUniqueId'] === 1 && item.options.unique && item.options.sparse));
  assert.ok(indexes.some((item) => item.keys['syncIdentity.crmClientId'] === 1 && item.options.unique && item.options.sparse));
  assert.ok(indexes.some((item) => item.keys['syncIdentity.ccpClientId'] === 1 && item.options.sparse));
  assert.ok(indexes.some((item) => item.keys['syncIdentity.leadNumber'] === 1 && item.options.sparse));
});

test('shared synchronization key is absent from frontend source and public env names', () => {
  const root = path.join(__dirname, '../../frontend');
  const files = [];
  const visit = (directory) => fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    if (['node_modules', 'dist'].includes(entry.name)) return;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(target); else files.push(target);
  });
  visit(root);
  const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  assert.doesNotMatch(source, /VITE_CCP_SHARED_API_KEY|NEXT_PUBLIC_CCP_SHARED_API_KEY|REACT_APP_CCP_SHARED_API_KEY|x-ccp-api-key/i);
});
