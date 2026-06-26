const express = require('express');
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Client = require('../models/Client');
const PendingApproval = require('../models/PendingApproval');
const { backfillApprovalStatus, normalizeApprovalStatus, normalizeClientOutput } = require('../controllers/clientController');
const { updateClientPendingApproval } = require('../utils/pendingApproval');
const { sanitizeClientPayloadForCrm, syncPendingApprovalToCrm } = require('../utils/crmPendingApprovalSync');
const { requireOptionalAuth } = require('../middleware/auth');
const { buildLeadVisibilityQuery, buildClientVisibilityQuery } = require('../utils/visibilityScope');

const router = express.Router();

function requireSharedKey(req, res, next) {
  const expectedKey = process.env.CCP_SHARED_API_KEY;
  if (!expectedKey) return next();

  const providedKey = req.get('x-ccp-api-key') || req.query.apiKey;
  if (providedKey !== expectedKey) {
    return res.status(401).json({ error: 'Invalid CCP API key' });
  }

  return next();
}

router.use(requireSharedKey, requireOptionalAuth);

function toPlain(doc) {
  return typeof doc?.toObject === 'function' ? doc.toObject() : { ...(doc || {}) };
}

function readAssignedName(value, fallback = '') {
  if (value && typeof value === 'object') return String(value.name || fallback || '').trim();
  return String(fallback || value || '').trim();
}

function buildAssignedUserIdentity(value, fallback = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const id = String(source._id || source.id || source.ccpUserId || fallback.id || fallback._id || fallback.ccpUserId || '').trim();
  const crmUserId = String(source.crmUserId || fallback.crmUserId || '').trim();
  const email = String(source.email || fallback.email || '').toLowerCase().trim();
  const name = String(source.name || fallback.name || '').trim();

  if (!id && !crmUserId && !email && !name) return null;

  return {
    id,
    _id: id,
    ccpUserId: id,
    crmUserId,
    email,
    name
  };
}

function normalizeLeadForCrm(lead) {
  const plain = toPlain(lead);
  const assignedName = readAssignedName(plain.assignedTo, plain.assignedToText);
  const assignedIdentity = buildAssignedUserIdentity(plain.assignedTo, {
    name: assignedName,
    email: plain.assignedToEmail,
    crmUserId: plain.assignedToCrmUserId
  });

  delete plain.assignedToEmail;

  return {
    ...plain,
    assignedTo: assignedIdentity || plain.assignedTo || assignedName,
    assignedToText: assignedName
  };
}

function normalizeClientForCrm(client) {
  const plain = normalizeClientOutput(toPlain(client));
  const adminControls = plain.adminControls || {};
  const assignedName = readAssignedName(adminControls.assignedTo, adminControls.assignedToText || plain.data?.importMeta?.assignedTo);
  const assignedIdentity = buildAssignedUserIdentity(adminControls.assignedTo, {
    name: assignedName,
    email: adminControls.assignedToEmail || plain.data?.importMeta?.assignedToEmail,
    crmUserId: adminControls.assignedToCrmUserId || plain.data?.importMeta?.assignedToCrmUserId
  });

  plain.data = {
    ...(plain.data || {}),
    importMeta: {
      ...(plain.data?.importMeta || {}),
      assignedTo: assignedName,
      assignedToEmail: assignedIdentity?.email || adminControls.assignedToEmail || plain.data?.importMeta?.assignedToEmail || '',
      assignedToId: assignedIdentity?.ccpUserId || plain.data?.importMeta?.assignedToId || '',
      assignedToCrmUserId: assignedIdentity?.crmUserId || adminControls.assignedToCrmUserId || plain.data?.importMeta?.assignedToCrmUserId || ''
    }
  };

  plain.adminControls = {
    ...adminControls,
    assignedTo: assignedIdentity || adminControls.assignedTo || assignedName,
    assignedToText: assignedName
  };
  delete plain.adminControls.assignedToEmail;

  return plain;
}

function normalizePendingApprovalForCrm(record) {
  const plain = toPlain(record);
  return {
    ...plain,
    payload: sanitizeClientPayloadForCrm(plain.payload || {})
  };
}

router.get('/health', (req, res) => {
  res.json({ ok: true, app: 'CCP', database: process.env.DB_NAME || 'ccp' });
});

router.get('/leads', async (req, res) => {
  const query = req.user ? await buildLeadVisibilityQuery(req.user) : {};
  const leads = await Lead.find(query)
    .populate('assignedTo', 'name email crmUserId avatarUrl role team teamId managerId operationHeadId')
    .sort({ leadCode: 1, createdAt: 1 })
    .lean();

  res.json({ ok: true, source: 'ccp', leads: leads.map(normalizeLeadForCrm) });
});

router.get('/clients', async (req, res) => {
  await backfillApprovalStatus();
  const query = req.user ? await buildClientVisibilityQuery(req.user) : {};
  const clients = await Client.find(query)
    .populate('selectedLead', 'leadCode company status emails mobileNo1 piboCategory eprCategory addressLine1 addressLine2 addressLine3 state city pinCode contactPerson designation')
    .populate('adminControls.assignedTo', 'name email crmUserId role avatarUrl team teamId managerId operationHeadId')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ ok: true, source: 'ccp', clients: clients.map(normalizeClientForCrm) });
});

router.get('/pending-approvals', async (req, res) => {
  const status = req.query.status
    ? normalizeApprovalStatus(req.query.status)
    : undefined;
  const query = { type: 'client', source: 'ccp' };
  if (status) query.approvalStatus = status;

  const approvals = await PendingApproval.find(query)
    .sort({ createdAt: -1 })
    .lean();

  res.json({ ok: true, source: 'ccp', approvals: approvals.map(normalizePendingApprovalForCrm) });
});

router.patch('/clients/:id/approval', async (req, res) => {
  const status = normalizeApprovalStatus(req.body.status);
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Approval status must be APPROVED or REJECTED' });
  }

  const id = String(req.params.id || '').trim();
  const remarks = String(req.body.remarks || '').trim();
  const actionBy = String(req.body.actionBy || req.get('x-action-by') || 'crm').trim();
  const query = mongoose.Types.ObjectId.isValid(id)
    ? { _id: id }
    : { 'data.importMeta.uniqueId': id };

  let client = await Client.findOne(query)
    .populate('selectedLead', 'leadCode company status emails mobileNo1 piboCategory eprCategory addressLine1 addressLine2 addressLine3 state city pinCode contactPerson designation')
    .populate('adminControls.assignedTo', 'name email crmUserId role avatarUrl');

  if (!client && mongoose.Types.ObjectId.isValid(id)) {
    client = await Client.findOne({ 'data.importMeta.uniqueId': id })
      .populate('selectedLead', 'leadCode company status emails mobileNo1 piboCategory eprCategory addressLine1 addressLine2 addressLine3 state city pinCode contactPerson designation')
      .populate('adminControls.assignedTo', 'name email crmUserId role avatarUrl');
  }

  if (!client) return res.status(404).json({ error: 'Client not found' });

  const assignedTo = client.adminControls?.assignedTo?._id || client.adminControls?.assignedTo;
  client.adminControls = {
    approvalStatus: status,
    visibilityStatus: client.adminControls?.visibilityStatus || 'LIVE',
    assignedToText: client.adminControls?.assignedToText || '',
    assignedToEmail: client.adminControls?.assignedToEmail || '',
    assignedToCrmUserId: client.adminControls?.assignedToCrmUserId || ''
  };
  if (assignedTo) client.adminControls.assignedTo = assignedTo;
  client.approvalMeta = {
    status,
    actionAt: new Date(),
    actionBy,
    remarks
  };
  await client.save();
  const pendingApproval = await updateClientPendingApproval(client, status, { actionBy, remarks, actionAt: client.approvalMeta.actionAt });
  const crmSync = pendingApproval
    ? await syncPendingApprovalToCrm(pendingApproval, { action: 'status' })
    : { skipped: true, reason: 'Pending approval record not found' };

  await client.populate('selectedLead', 'leadCode company status emails mobileNo1 piboCategory eprCategory addressLine1 addressLine2 addressLine3 state city pinCode contactPerson designation');
  await client.populate('adminControls.assignedTo', 'name email crmUserId role avatarUrl');

  res.json({ ok: true, client: normalizeClientOutput(client), crmSync });
});

module.exports = router;
