const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _test } = require('../src/controllers/mediaController');

test('Cloudinary signatures are deterministic and secrets are not part of the result', () => {
  const params = { folder: 'ccp/client-documents', public_id: 'invoice-123', timestamp: 123456 };
  assert.equal(_test.signature(params, 'secret'), 'a79a249780f6ee904a81bc3e7ea9aa4bd2b361e2');
  assert.equal(_test.signature(params, 'secret').includes('secret'), false);
});

test('media validation accepts supported image/video/doc formats and rejects executables', () => {
  ['image/png', 'video/mp4', 'application/pdf', 'message/rfc822'].forEach((type) => assert.equal(_test.ALLOWED_MIME.test(type), true));
  assert.equal(_test.ALLOWED_MIME.test('application/x-msdownload'), false);
});

test('embedded media guard finds nested base64 but permits Cloudinary URLs', () => {
  assert.equal(_test.containsEmbeddedMedia({ data: { file: { url: 'data:image/png;base64,abc' } } }), true);
  assert.equal(_test.containsEmbeddedMedia({ url: 'https://res.cloudinary.com/demo/image/upload/a.png' }), false);
});

test('frontend media paths no longer use FileReader/base64 persistence', () => {
  const frontend = path.join(__dirname, '../../frontend/src');
  const files = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : /\.(jsx|js)$/.test(entry.name) && files.push(path.join(dir, entry.name)));
  walk(frontend);
  const offenders = files.filter((file) => fs.readFileSync(file, 'utf8').includes('new FileReader'));
  assert.deepEqual(offenders, []);
});

test('large lead imports are split into timeout-safe batches with lightweight responses', () => {
  const frontend = fs.readFileSync(path.join(__dirname, '../../frontend/src/pages/LeadGeneration.jsx'), 'utf8');
  const backend = fs.readFileSync(path.join(__dirname, '../src/controllers/leadController.js'), 'utf8');
  assert.match(frontend, /const chunkSize = 25/);
  assert.match(frontend, /includeRecords: false/);
  assert.match(frontend, /Importing batch/);
  assert.match(backend, /rows\.length > 50/);
  assert.match(backend, /includeRecords === true/);
});

test('large client imports are split into smaller timeout-safe batches', () => {
  const frontend = fs.readFileSync(path.join(__dirname, '../../frontend/src/pages/ClientMaster.jsx'), 'utf8');
  const backend = fs.readFileSync(path.join(__dirname, '../src/controllers/clientController.js'), 'utf8');
  assert.match(frontend, /const chunkSize = 10/);
  assert.match(frontend, /Importing client batch/);
  assert.match(frontend, /clients\.bulkImport\(chunks\[chunkIndex\], \{ includeRecords: false \}\)/);
  assert.match(backend, /rows\.length > 25/);
  assert.match(backend, /includeRecords === true/);
  assert.match(backend, /req\.baseUrl === '\/api\/clients'/);
});

test('CCP exposes reconciliation metadata and ships the CRM full-sync implementation prompt', () => {
  const routes = fs.readFileSync(path.join(__dirname, '../src/routes/ccp.js'), 'utf8');
  const prompt = fs.readFileSync(path.join(__dirname, '../../docs/CRM_CLIENT_SYNC_PROMPT.md'), 'utf8');
  assert.match(routes, /router\.get\('\/clients\/reconciliation'/);
  assert.match(routes, /count: normalized\.length/);
  assert.match(prompt, /all 265 live applications/);
  assert.match(prompt, /Do not filter by annual-return applicability/);
  assert.match(prompt, /Chunk requests into 10 clients each/);
});
