const mongoose = require('mongoose');
const Client = require('../models/Client');
const ClientSyncRun = require('../models/ClientSyncRun');
const { deepMerge, identitiesFromClient, containsBase64, failureKey, normalizeIdentity } = require('../utils/clientSync');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function liveClientQuery() {
  return { $nor: [
    { 'adminControls.visibilityStatus': /^discontinued$/i },
    { 'adminControls.visibilityStatus': /^suspended$/i }
  ] };
}

function identityQuery(identities) {
  const { normalized, display } = identities;
  const conditions = [];
  if (normalized.uniqueId) conditions.push({ 'syncIdentity.normalizedUniqueId': normalized.uniqueId }, { 'data.importMeta.uniqueId': new RegExp(`^${escapeRegex(display.uniqueId)}$`, 'i') });
  if (normalized.ccpClientId) conditions.push({ 'syncIdentity.ccpClientId': normalized.ccpClientId }, { 'data.importMeta.ccpClientId': new RegExp(`^${escapeRegex(display.ccpClientId)}$`, 'i') });
  if (normalized.crmClientId) conditions.push({ 'syncIdentity.crmClientId': normalized.crmClientId }, { 'data.importMeta.crmClientId': new RegExp(`^${escapeRegex(display.crmClientId)}$`, 'i') });
  if (normalized.leadNumber) conditions.push({ 'syncIdentity.leadNumber': normalized.leadNumber }, { 'data.importMeta.leadNumber': new RegExp(`^${escapeRegex(display.leadNumber)}$`, 'i') });
  return conditions.length ? { $or: conditions } : null;
}

function meaningfulSyncIdentity(identities, syncRunId) {
  const syncIdentity = { lastSyncRunId: syncRunId, lastSyncedAt: new Date() };
  if (identities.normalized.uniqueId) syncIdentity.normalizedUniqueId = identities.normalized.uniqueId;
  if (identities.normalized.crmClientId) syncIdentity.crmClientId = identities.normalized.crmClientId;
  if (identities.normalized.ccpClientId) syncIdentity.ccpClientId = identities.normalized.ccpClientId;
  if (identities.normalized.leadNumber) syncIdentity.leadNumber = identities.normalized.leadNumber;
  return syncIdentity;
}

function normalizeAdminControls(value = {}) {
  const input = { ...value };
  if (input.approvalStatus) input.approvalStatus = String(input.approvalStatus).trim().toUpperCase();
  if (input.visibilityStatus) input.visibilityStatus = String(input.visibilityStatus).trim().toUpperCase();
  if (input.assignedTo && typeof input.assignedTo === 'object') {
    input.assignedToText = input.assignedToText || input.assignedTo.name;
    input.assignedToEmail = input.assignedToEmail || input.assignedTo.email;
    input.assignedToCrmUserId = input.assignedToCrmUserId || input.assignedTo.crmUserId;
    input.assignedTo = input.assignedTo._id || input.assignedTo.id || '';
  }
  if (input.assignedTo && !mongoose.Types.ObjectId.isValid(String(input.assignedTo))) delete input.assignedTo;
  return input;
}

async function executeTransactionally(operation) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await operation(session); });
    return result;
  } catch (error) {
    const unsupported = /Transaction numbers are only allowed|replica set|does not support retryable writes/i.test(String(error.message || ''));
    if (!unsupported) throw error;
    return operation(null);
  } finally {
    await session.endSession();
  }
}

async function upsertOne(row, syncRunId) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Client record must be an object');
  if (containsBase64(row)) throw new Error('Base64 media is not allowed; send Cloudinary metadata');
  const identities = identitiesFromClient(row);
  if (!identities.primary) throw new Error('At least one stable client identity is required');
  const query = identityQuery(identities);

  return executeTransactionally(async (session) => {
    let find = Client.find(query).limit(2);
    if (session) find = find.session(session);
    const matches = await find;
    if (matches.length > 1) throw new Error(`Identity aliases match multiple Client records for ${identities.primaryDisplay}`);
    const created = matches.length === 0;
    const client = matches[0] || new Client();
    const incomingData = row.data && typeof row.data === 'object' ? row.data : {};
    incomingData.importMeta = deepMerge(incomingData.importMeta || {}, identities.display);
    client.data = deepMerge(client.data || {}, incomingData);
    client.syncIdentity = deepMerge(client.syncIdentity?.toObject?.() || client.syncIdentity || {}, meaningfulSyncIdentity(identities, syncRunId));
    client.adminControls = deepMerge(client.adminControls?.toObject?.() || client.adminControls || {}, normalizeAdminControls(row.adminControls || {}));
    if (row.approvalMeta) client.approvalMeta = deepMerge(client.approvalMeta?.toObject?.() || client.approvalMeta || {}, row.approvalMeta);
    if (row.workflowStatus) client.workflowStatus = row.workflowStatus === 'submitted' ? 'submitted' : 'draft';
    if (row.selectedLead && mongoose.Types.ObjectId.isValid(String(row.selectedLead?._id || row.selectedLead))) client.selectedLead = row.selectedLead?._id || row.selectedLead;
    for (const field of ['createdByName', 'createdByEmail', 'createdByCrmUserId']) if (!client[field] && row[field]) client[field] = row[field];
    client.markModified('data');
    client.markModified('syncIdentity');
    client.markModified('adminControls');
    await client.save({ session: session || undefined });
    return { client, created, identities };
  });
}

async function getOrCreateRun(syncRunId, expectedTotal) {
  let run = await ClientSyncRun.findOne({ syncRunId }).select('+processedKeys +receivedKeys');
  if (run && run.expectedTotal !== expectedTotal) {
    const error = new Error('expectedTotal does not match the existing synchronization run');
    error.statusCode = 409;
    throw error;
  }
  if (!run) {
    try { run = await ClientSyncRun.create({ syncRunId, expectedTotal }); }
    catch (error) {
      if (error.code !== 11000) throw error;
      run = await ClientSyncRun.findOne({ syncRunId }).select('+processedKeys +receivedKeys');
    }
  }
  return run;
}

exports.bulkUpsert = async (req, res) => {
  const rows = Array.isArray(req.body?.clients) ? req.body.clients : [];
  const expectedTotal = Number(req.body?.expectedTotal || 0);
  const syncRunId = String(req.body?.syncRunId || '').trim();
  if (!UUID.test(syncRunId)) return res.status(400).json({ error: 'A valid syncRunId UUID is required' });
  if (!Number.isInteger(expectedTotal) || expectedTotal < 1) return res.status(400).json({ error: 'expectedTotal must be a positive integer' });
  if (!rows.length) return res.status(400).json({ error: 'No clients provided' });
  if (rows.length > 10) return res.status(400).json({ error: 'A maximum of 10 clients is allowed per synchronization batch' });

  let run;
  try { run = await getOrCreateRun(syncRunId, expectedTotal); }
  catch (error) { return res.status(error.statusCode || 500).json({ error: error.message }); }
  const knownSuccess = new Set(run.processedKeys || []);
  const receivedKeys = new Set(run.receivedKeys || []);
  const failuresByKey = new Map((run.failedRecords || []).map((failure) => [failure.key, failure]));
  const processedIds = new Set(run.processedIds || []);
  let created = 0; let updated = 0; const batchFailures = []; const batchProcessed = [];

  for (let index = 0; index < rows.length; index += 1) {
    const key = failureKey(rows[index], index);
    receivedKeys.add(key);
    try {
      const result = await upsertOne(rows[index], syncRunId);
      const successKey = result.identities.primary;
      failuresByKey.delete(key); failuresByKey.delete(successKey);
      processedIds.add(result.identities.primaryDisplay);
      batchProcessed.push(result.identities.primaryDisplay);
      if (!knownSuccess.has(successKey)) {
        knownSuccess.add(successKey);
        if (result.created) created += 1; else updated += 1;
      }
    } catch (error) {
      const identities = identitiesFromClient(rows[index]);
      const failure = { key, row: index + 1, uniqueId: identities.display.uniqueId, crmClientId: identities.display.crmClientId, error: error.message || 'Unable to upsert client' };
      failuresByKey.set(key, failure);
      batchFailures.push(failure);
    }
  }

  run.processedKeys = [...knownSuccess];
  run.receivedKeys = [...receivedKeys];
  run.processedIds = [...processedIds];
  run.failedRecords = [...failuresByKey.values()];
  run.receivedTotal = receivedKeys.size;
  run.createdCount += created;
  run.updatedCount += updated;
  run.failedCount = run.failedRecords.length;
  run.status = run.failedCount ? (run.processedIds.length ? 'PARTIAL' : 'FAILED') : 'RUNNING';
  run.durationMs = Date.now() - run.startedAt.getTime();
  await run.save();

  return res.status(batchFailures.length === rows.length ? 400 : 200).json({
    ok: batchFailures.length === 0,
    syncRunId,
    expectedTotal,
    received: rows.length,
    processed: rows.length,
    successfullyUpserted: rows.length - batchFailures.length,
    created,
    updated,
    failed: batchFailures.length,
    processedIds: batchProcessed,
    failedRecords: batchFailures
  });
};

async function reconciliationPayload(syncRunId) {
  const run = await ClientSyncRun.findOne({ syncRunId }).select('+processedKeys +receivedKeys');
  if (!run) { const error = new Error('Synchronization run not found'); error.statusCode = 404; throw error; }
  const clients = await Client.find(liveClientQuery()).select('data.importMeta syncIdentity').lean();
  const identities = clients.map((client) => ({
    uniqueId: client.data?.importMeta?.uniqueId || '',
    crmClientId: client.data?.importMeta?.crmClientId || '',
    ccpClientId: client.data?.importMeta?.ccpClientId || '',
    leadNumber: client.data?.importMeta?.leadNumber || ''
  }));
  const storedKeys = new Set(clients.flatMap((client) => [client.syncIdentity?.normalizedUniqueId, client.syncIdentity?.ccpClientId, client.syncIdentity?.crmClientId, client.syncIdentity?.leadNumber].filter(Boolean)));
  const missingIds = (run.processedIds || []).filter((display) => !storedKeys.has(normalizeIdentity(display)));
  const expectedKeys = new Set(run.processedKeys || []);
  const unexpectedIds = clients
    .map((client) => client.data?.importMeta?.uniqueId || client.data?.importMeta?.ccpClientId || client.data?.importMeta?.crmClientId || client.data?.importMeta?.leadNumber || '')
    .filter((display) => display && !expectedKeys.has(normalizeIdentity(display)));
  const complete = run.receivedTotal === run.expectedTotal
    && run.processedIds.length === run.expectedTotal
    && clients.length === run.expectedTotal
    && !run.failedRecords.length
    && missingIds.length === 0
    && unexpectedIds.length === 0;
  run.status = complete ? 'RECONCILED' : (run.processedIds.length ? 'PARTIAL' : 'FAILED');
  run.missingIds = missingIds;
  run.unexpectedIds = unexpectedIds;
  run.completedAt = new Date();
  run.durationMs = run.completedAt.getTime() - run.startedAt.getTime();
  await run.save();
  return { ok: complete, syncRunId, expectedTotal: run.expectedTotal, ccpStoredCount: clients.length, successfullyUpserted: run.processedIds.length, identities, missingIds, unexpectedIds, failedRecords: run.failedRecords, totalDurationMs: run.durationMs, status: run.status };
}

exports.reconcile = async (req, res) => {
  try { const payload = await reconciliationPayload(String(req.query.syncRunId || '').trim()); return res.status(payload.ok ? 200 : 409).json(payload); }
  catch (error) { return res.status(error.statusCode || 500).json({ error: error.message }); }
};

exports.listRuns = async (req, res) => {
  const [runs, ccpStoredCount] = await Promise.all([ClientSyncRun.find({}).sort({ startedAt: -1 }).limit(100).lean(), Client.countDocuments(liveClientQuery())]);
  res.json({ ok: true, ccpStoredCount, runs });
};

exports._test = { liveClientQuery, identityQuery, meaningfulSyncIdentity, normalizeAdminControls, upsertOne, reconciliationPayload, UUID };
