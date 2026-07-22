const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { requireRoles } = require('../src/middleware/auth');
const { ADMIN_ROLES } = require('../src/constants/roles');
const { _test } = require('../src/controllers/clientController');

test('bulk role middleware rejects manager and permits admin/superadmin', () => {
  const run = (role) => { let status; let next = false; const res = { status(code) { status = code; return this; }, json() { return this; } }; requireRoles(ADMIN_ROLES)({ user: { role } }, res, () => { next = true; }); return { status, next }; };
  assert.deepEqual(run('manager'), { status: 403, next: false });
  assert.equal(run('admin').next, true);
  assert.equal(run('superadmin').next, true);
});

test('PO validation requires complete yes rows, supports arrays, and rejects duplicate years', () => {
  const file = { name: 'po.pdf', url: 'https://files/po.pdf' };
  assert.match(_test.validatePurchaseOrderConfirmation({}), /select Yes or No/);
  assert.match(_test.validatePurchaseOrderConfirmation({ mode: 'yes', rows: [{ fyYear: '2023-24', poNumber: '', file, service: ['PLANT AUDIT'] }] }), /requires FY Year/);
  assert.equal(_test.validatePurchaseOrderConfirmation({ mode: 'yes', rows: [{ fyYear: '2023-24', poNumber: 'PO-1', file, service: ['PLANT AUDIT', 'CONSULTANCY FEE'] }] }), '');
  assert.match(_test.validatePurchaseOrderConfirmation({ mode: 'yes', rows: [{ fyYear: '2023-24', poNumber: '1', file, service: ['PLANT AUDIT'] }, { fyYear: '2023-24', poNumber: '2', file, service: ['PLANT AUDIT'] }] }), /Duplicate/);
});

test('special approval and annual-year lock rules are enforced', () => {
  assert.match(_test.validatePurchaseOrderConfirmation({ mode: 'no' }), /Upload special approval/);
  assert.equal(_test.validatePurchaseOrderConfirmation({ mode: 'no', approvalNote: 'Approved by director' }), '');
  const annual = { filings: { '2023-24': { draft: { purchaseOrderConfirmation: { mode: 'yes', confirmed: true, rows: [{ fyYear: '2023-24' }] } } } } };
  assert.equal(_test.annualYearUnlocked(annual, '2023-24'), true);
  assert.equal(_test.annualYearUnlocked(annual, '2024-25'), false);
});

test('client tabs and light table themes match the CRM contract', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../frontend/src/pages/ClientMaster.jsx'), 'utf8');
  const labels = ['Client Basic Info','Address Details','Document','CTE & CTO / CCA','CPCB Login Credential','CPCB Screenshot','Authorized Person Details'];
  let cursor = -1; labels.forEach((label) => { const next = source.indexOf(`label: '${label}'`); assert.ok(next > cursor, label); cursor = next; });
  assert.equal(source.includes("label: 'Validation Documents'"), false);
  assert.match(source, /from-teal-50 via-emerald-50 to-cyan-50/);
});
