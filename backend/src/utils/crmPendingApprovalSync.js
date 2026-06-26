const http = require('http');
const https = require('https');
const PendingApproval = require('../models/PendingApproval');

function getSyncUrl() {
  return process.env.CRM_PENDING_APPROVAL_SYNC_URL ||
    process.env.CCP_TO_CRM_PENDING_APPROVAL_SYNC_URL ||
    '';
}

function requestJson(url, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const body = JSON.stringify(payload);
    const transport = target.protocol === 'https:' ? https : http;

    const req = transport.request({
      method: 'POST',
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers
      },
      timeout: 8000
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        let data = {};
        if (raw) {
          try {
            data = JSON.parse(raw);
          } catch {
            data = { raw };
          }
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          return resolve({ statusCode: res.statusCode, data });
        }

        const error = new Error(data.error || `CRM pending approval sync failed with status ${res.statusCode}`);
        error.statusCode = res.statusCode;
        error.data = data;
        return reject(error);
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('CRM pending approval sync request timed out'));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sanitizeClientPayloadForCrm(payload = {}) {
  const plain = { ...(payload || {}) };
  const data = { ...(plain.data || {}) };
  const importMeta = { ...(data.importMeta || {}) };
  const adminControls = { ...(plain.adminControls || {}) };
  const assignedName = String(importMeta.assignedTo || adminControls.assignedToText || '').trim();

  if (assignedName) {
    importMeta.assignedTo = assignedName;
    adminControls.assignedTo = assignedName;
    adminControls.assignedToText = assignedName;
  }

  delete adminControls.assignedToEmail;
  delete adminControls.assignedToCrmUserId;

  return {
    ...plain,
    data: {
      ...data,
      importMeta
    },
    adminControls
  };
}

function buildPayload(record, action = 'upsert') {
  const plain = typeof record.toObject === 'function' ? record.toObject() : record;
  return {
    action,
    type: plain.type,
    source: plain.source || 'ccp',
    sourceClientId: plain.sourceClientId,
    uniqueId: plain.uniqueId || '',
    dedupeKey: plain.uniqueId || plain.sourceClientId,
    clientName: plain.clientName || '',
    approvalStatus: plain.approvalStatus || 'PENDING',
    piboCategory: plain.piboCategory || '',
    eprCategory: plain.eprCategory || '',
    createdByName: plain.createdByName || '',
    requestDate: plain.requestDate || '',
    requestTime: plain.requestTime || '',
    actionBy: plain.actionBy || '',
    actionAt: plain.actionAt || undefined,
    remarks: plain.remarks || '',
    payload: sanitizeClientPayloadForCrm(plain.payload || {})
  };
}

async function markSyncSkipped(record, reason) {
  if (!record?._id) return { skipped: true, reason };
  await PendingApproval.updateOne(
    { _id: record._id },
    { $set: { crmSyncStatus: 'PENDING', crmSyncError: reason } }
  );
  return { skipped: true, reason };
}

async function syncPendingApprovalToCrm(record, options = {}) {
  const url = getSyncUrl();
  if (!url) return markSyncSkipped(record, 'CRM_PENDING_APPROVAL_SYNC_URL not configured');

  const secret = process.env.CRM_SHARED_SECRET || process.env.CCP_SHARED_SECRET;
  const headers = {};
  if (secret) headers['x-ccp-secret'] = secret;

  try {
    const response = await requestJson(url, buildPayload(record, options.action), headers);
    const crmApprovalId = response.data?.approvalId || response.data?.id || response.data?._id || '';
    await PendingApproval.updateOne(
      { _id: record._id },
      {
        $set: {
          crmSyncStatus: 'SYNCED',
          crmSyncAt: new Date(),
          crmSyncError: '',
          ...(crmApprovalId ? { crmApprovalId: String(crmApprovalId) } : {})
        }
      }
    );
    return { ok: true, statusCode: response.statusCode, data: response.data };
  } catch (err) {
    await PendingApproval.updateOne(
      { _id: record._id },
      {
        $set: {
          crmSyncStatus: 'FAILED',
          crmSyncAt: new Date(),
          crmSyncError: err.message || 'CRM pending approval sync failed'
        }
      }
    );
    return { ok: false, error: err.message || 'CRM pending approval sync failed' };
  }
}

module.exports = { syncPendingApprovalToCrm, sanitizeClientPayloadForCrm };
