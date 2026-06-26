const PendingApproval = require('../models/PendingApproval');

function readDateParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return {
    requestDate: safeDate.toISOString().slice(0, 10),
    requestTime: safeDate.toISOString().slice(11, 19)
  };
}

function readUserName(user) {
  return user?.name || user?.email || '';
}

function buildClientPendingApproval(client, createdByName = '') {
  const plain = typeof client.toObject === 'function' ? client.toObject() : client;
  const data = plain.data || {};
  const importMeta = data.importMeta || {};
  const clientName = data.basic?.clientLegalName || data.basic?.tradeName || plain.selectedLead?.company || '';
  const { requestDate, requestTime } = readDateParts(plain.createdAt || new Date());

  return {
    type: 'client',
    source: 'ccp',
    sourceClientId: String(plain._id || plain.id || ''),
    uniqueId: importMeta.uniqueId || importMeta.leadNumber || plain.selectedLead?.leadCode || '',
    clientName,
    approvalStatus: plain.adminControls?.approvalStatus || plain.approvalMeta?.status || 'PENDING',
    piboCategory: data.basic?.piboCategory || plain.selectedLead?.piboCategory || '',
    eprCategory: data.basic?.eprCategory || plain.selectedLead?.eprCategory || '',
    createdByName,
    requestDate,
    requestTime,
    payload: plain
  };
}

async function upsertClientPendingApproval(client, createdByName = '') {
  const record = buildClientPendingApproval(client, createdByName);
  if (!record.sourceClientId) return null;
  const query = record.uniqueId
    ? {
      type: 'client',
      source: 'ccp',
      $or: [
        { sourceClientId: record.sourceClientId },
        { uniqueId: record.uniqueId }
      ]
    }
    : { type: 'client', source: 'ccp', sourceClientId: record.sourceClientId };

  return PendingApproval.findOneAndUpdate(
    query,
    {
      $set: {
        ...record,
        crmSyncStatus: 'PENDING',
        crmSyncError: ''
      },
      $setOnInsert: {
        nextReminderAt: new Date(),
        reminderCount: 0,
        notifiedAdminEmails: []
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function updateClientPendingApproval(client, status, options = {}) {
  const plain = typeof client.toObject === 'function' ? client.toObject() : client;
  const sourceClientId = String(plain._id || plain.id || '');
  if (!sourceClientId) return null;
  const record = buildClientPendingApproval(client, options.createdByName || '');
  const query = record.uniqueId
    ? {
      type: 'client',
      source: 'ccp',
      $or: [
        { sourceClientId },
        { uniqueId: record.uniqueId }
      ]
    }
    : { type: 'client', source: 'ccp', sourceClientId };

  const actionAt = options.actionAt || new Date();
  return PendingApproval.findOneAndUpdate(
    query,
    {
      $set: {
        ...record,
        approvalStatus: status,
        actionBy: options.actionBy || '',
        actionAt,
        remarks: options.remarks || '',
        crmSyncStatus: 'PENDING',
        crmSyncError: ''
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

module.exports = {
  readUserName,
  upsertClientPendingApproval,
  updateClientPendingApproval
};
