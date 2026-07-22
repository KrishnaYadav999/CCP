const mongoose = require('mongoose');
const crypto = require('crypto');
const Client = require('../models/Client');
const AnnualReturn = require('../models/AnnualReturn');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { readUserName, upsertClientPendingApproval } = require('../utils/pendingApproval');
const { syncPendingApprovalToCrm } = require('../utils/crmPendingApprovalSync');
const { buildClientVisibilityQuery } = require('../utils/visibilityScope');
const { recordAudit } = require('./leadHistoryController');
const { ADMIN_ROLES } = require('../constants/roles');

const isAdmin = (user) => ADMIN_ROLES.includes(String(user?.role || '').toLowerCase());

function stripDangerousKeys(value) {
  if (Array.isArray(value)) return value.map(stripDangerousKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['__proto__', 'prototype', 'constructor'].includes(key))
    .map(([key, nested]) => [key, stripDangerousKeys(nested)]));
}

async function auditQuotation(client, user, type, title, description, metadata = {}) {
  if (!client?.selectedLead) return;
  const lead = await Lead.findById(client.selectedLead).lean();
  if (!lead) return;
  await recordAudit({ lead, user, type, title, description, metadata: { clientId: String(client._id), quotationNumber: client.data?.validation?.quotationNumber || '', ...metadata } });
}

const INVALID_IDENTITY_VALUES = new Set(['', 'n/a', 'na', '-', 'null', 'none', 'nil', 'not applicable']);

function normalizeAssignedUserInput(value) {
  if (!value || typeof value !== 'object') return { assignedTo: value };
  return {
    assignedTo: value._id || value.id || value.ccpUserId || '',
    assignedToText: value.name || '',
    assignedToEmail: value.email || '',
    assignedToCrmUserId: value.crmUserId || ''
  };
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
    name,
    email
  };
}

function readIdentityValue(value) {
  const raw = String(value || '').trim();
  if (INVALID_IDENTITY_VALUES.has(raw.toLowerCase())) return '';
  return raw;
}

function normalizeApprovalStatus(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'APPROVED') return 'APPROVED';
  if (raw === 'REJECTED') return 'REJECTED';
  return 'PENDING';
}

function normalizeAdminControls(input = {}, existing = {}) {
  const assignedInput = normalizeAssignedUserInput(input.assignedTo);
  const adminControls = {
    ...(existing || {}),
    ...(input || {})
  };

  if (input.assignedTo && typeof input.assignedTo === 'object') {
    adminControls.assignedTo = assignedInput.assignedTo;
    adminControls.assignedToText = adminControls.assignedToText || assignedInput.assignedToText;
    adminControls.assignedToEmail = adminControls.assignedToEmail || assignedInput.assignedToEmail;
    adminControls.assignedToCrmUserId = adminControls.assignedToCrmUserId || assignedInput.assignedToCrmUserId;
  }

  if (Object.prototype.hasOwnProperty.call(input || {}, 'approvalStatus')) {
    adminControls.approvalStatus = normalizeApprovalStatus(input.approvalStatus);
  } else {
    adminControls.approvalStatus = normalizeApprovalStatus(existing?.approvalStatus);
  }

  if (!adminControls.visibilityStatus) adminControls.visibilityStatus = existing?.visibilityStatus || 'LIVE';
  if (!adminControls.assignedTo) delete adminControls.assignedTo;
  if (adminControls.assignedToEmail) adminControls.assignedToEmail = String(adminControls.assignedToEmail).toLowerCase().trim();

  return adminControls;
}

function createDefaultAdminControls(input = {}) {
  return {
    ...normalizeAdminControls(input, { approvalStatus: 'PENDING', visibilityStatus: 'LIVE' }),
    approvalStatus: 'PENDING'
  };
}

function applyAssignedNameToImportMeta(data = {}, adminControls = {}) {
  const assignedName = String(adminControls.assignedToText || '').trim();
  if (!assignedName) return data;

  return {
    ...data,
    importMeta: {
      ...(data.importMeta || {}),
      assignedTo: assignedName,
      assignedToEmail: adminControls.assignedToEmail || data.importMeta?.assignedToEmail || '',
      assignedToCrmUserId: adminControls.assignedToCrmUserId || data.importMeta?.assignedToCrmUserId || ''
    }
  };
}

function readFirstPresentValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');
}

function normalizeClientData(data = {}) {
  data = stripDangerousKeys(data);
  const basic = { ...(data.basic || {}) };
  const onboardingYear = readFirstPresentValue(
    basic.onboardingYear,
    basic.clientOnboardingYear,
    data.onboardingYear,
    data.clientOnboardingYear
  );
  const firstAnnualReturnYear = readFirstPresentValue(
    basic.firstAnnualReturnYear,
    basic.firstAnnualReturnYearApplicable,
    basic.firstAnnualReturnYearPplicable,
    basic.annualReturnYearApplicable,
    basic.annualReturnYearPplicable,
    basic.annualReturnYear,
    data.firstAnnualReturnYear,
    data.firstAnnualReturnYearApplicable,
    data.firstAnnualReturnYearPplicable,
    data.annualReturnYearApplicable,
    data.annualReturnYearPplicable,
    data.annualReturnYear
  );

  if (onboardingYear !== undefined) {
    basic.onboardingYear = String(onboardingYear).trim();
  }

  if (firstAnnualReturnYear !== undefined) {
    basic.firstAnnualReturnYear = String(firstAnnualReturnYear).trim();
  }

  delete basic.clientOnboardingYear;
  delete basic.firstAnnualReturnYearApplicable;
  delete basic.firstAnnualReturnYearPplicable;
  delete basic.annualReturnYearApplicable;
  delete basic.annualReturnYearPplicable;
  delete basic.annualReturnYear;

  const normalized = {
    ...data,
    basic
  };

  delete normalized.onboardingYear;
  delete normalized.clientOnboardingYear;
  delete normalized.firstAnnualReturnYear;
  delete normalized.firstAnnualReturnYearApplicable;
  delete normalized.firstAnnualReturnYearPplicable;
  delete normalized.annualReturnYearApplicable;
  delete normalized.annualReturnYearPplicable;
  delete normalized.annualReturnYear;

  return normalized;
}

function applyRequestYearsToData(data = {}, body = {}) {
  const basic = { ...(data.basic || {}) };
  const onboardingYear = readFirstPresentValue(
    basic.onboardingYear,
    body.onboardingYear,
    body.clientOnboardingYear
  );
  const firstAnnualReturnYear = readFirstPresentValue(
    basic.firstAnnualReturnYear,
    body.firstAnnualReturnYear,
    body.firstAnnualReturnYearApplicable,
    body.annualReturnYearApplicable,
    body.annualReturnYear
  );

  if (onboardingYear !== undefined) basic.onboardingYear = String(onboardingYear).trim();
  if (firstAnnualReturnYear !== undefined) basic.firstAnnualReturnYear = String(firstAnnualReturnYear).trim();

  return {
    ...data,
    basic
  };
}

async function forcePersistClientYears(client) {
  const onboardingYear = String(client.data?.basic?.onboardingYear || '').trim();
  const firstAnnualReturnYear = String(client.data?.basic?.firstAnnualReturnYear || '').trim();
  const update = { $set: {}, $unset: {} };

  if (onboardingYear) {
    update.$set.onboardingYear = onboardingYear;
    update.$set['data.basic.onboardingYear'] = onboardingYear;
    client.onboardingYear = onboardingYear;
    client.data.basic.onboardingYear = onboardingYear;
  } else {
    update.$unset.onboardingYear = '';
    update.$unset['data.basic.onboardingYear'] = '';
    client.onboardingYear = undefined;
    if (client.data?.basic) delete client.data.basic.onboardingYear;
  }

  if (firstAnnualReturnYear) {
    update.$set.firstAnnualReturnYear = firstAnnualReturnYear;
    update.$set['data.basic.firstAnnualReturnYear'] = firstAnnualReturnYear;
    client.firstAnnualReturnYear = firstAnnualReturnYear;
    client.data.basic.firstAnnualReturnYear = firstAnnualReturnYear;
  } else {
    update.$unset.firstAnnualReturnYear = '';
    update.$unset['data.basic.firstAnnualReturnYear'] = '';
    client.firstAnnualReturnYear = undefined;
    if (client.data?.basic) delete client.data.basic.firstAnnualReturnYear;
  }

  if (!Object.keys(update.$set).length) delete update.$set;
  if (!Object.keys(update.$unset).length) delete update.$unset;
  if (Object.keys(update).length) {
    await Client.updateOne({ _id: client._id }, update, { strict: false });
  }
  return Client.findById(client._id);
}

function logClientYearDebug(stage, details = {}) {
  const data = details.data || {};
  const basic = data.basic || {};
  console.info('[client-years]', {
    stage,
    clientId: details.clientId || '',
    selectedLead: details.selectedLead || '',
    workflowStatus: details.workflowStatus || '',
    onboardingYear: basic.onboardingYear || data.onboardingYear || data.clientOnboardingYear || '',
    firstAnnualReturnYear: basic.firstAnnualReturnYear || data.firstAnnualReturnYear || data.firstAnnualReturnYearApplicable || '',
    topLevelOnboardingYear: details.onboardingYear || '',
    topLevelFirstAnnualReturnYear: details.firstAnnualReturnYear || '',
    requestedClientId: details.requestedClientId || '',
    relatedClientIds: details.relatedClientIds || [],
    leadNumber: details.leadNumber || '',
    uniqueId: details.uniqueId || ''
  });
}

async function enrichClientOwnership(input = {}, user) {
  const adminControls = { ...(input.adminControls || {}) };
  if (adminControls.assignedTo && typeof adminControls.assignedTo === 'object') {
    const assignedInput = normalizeAssignedUserInput(adminControls.assignedTo);
    adminControls.assignedTo = assignedInput.assignedTo;
    adminControls.assignedToText = adminControls.assignedToText || assignedInput.assignedToText;
    adminControls.assignedToEmail = adminControls.assignedToEmail || assignedInput.assignedToEmail;
    adminControls.assignedToCrmUserId = adminControls.assignedToCrmUserId || assignedInput.assignedToCrmUserId;
  }
  const ownership = {
    adminControls,
    createdByName: input.createdByName || readUserName(user),
    createdByEmail: input.createdByEmail || user?.email || '',
    createdByCrmUserId: input.createdByCrmUserId || user?.crmUserId || ''
  };

  if (ownership.createdByEmail) {
    ownership.createdByEmail = String(ownership.createdByEmail).toLowerCase().trim();
  }

  if (adminControls.assignedToEmail) {
    adminControls.assignedToEmail = String(adminControls.assignedToEmail).toLowerCase().trim();
  }

  // A CRM MongoDB id is external identity only. Resolve it to a CCP User via
  // crmUserId first, then email, and never assign the external id directly.
  let assignedUser = null;
  if (adminControls.assignedToCrmUserId) {
    assignedUser = await User.findOne({ crmUserId: String(adminControls.assignedToCrmUserId).trim() })
      .select('name email crmUserId').lean();
  }
  if (!assignedUser && adminControls.assignedToEmail) {
    assignedUser = await User.findOne({ email: adminControls.assignedToEmail })
      .select('name email crmUserId').lean();
  }

  if (!assignedUser && adminControls.assignedTo && mongoose.Types.ObjectId.isValid(String(adminControls.assignedTo))) {
    assignedUser = await User.findById(adminControls.assignedTo).select('name email crmUserId').lean();
  }

  if (!assignedUser && adminControls.assignedTo) {
    adminControls.assignedToText = adminControls.assignedToText || String(adminControls.assignedTo).trim();
    adminControls.assignedToCrmUserId = adminControls.assignedToCrmUserId || String(adminControls.assignedTo).trim();
    delete adminControls.assignedTo;
  }
  if (!assignedUser) return ownership;

  adminControls.assignedTo = assignedUser._id;
  adminControls.assignedToText = adminControls.assignedToText || assignedUser.name || assignedUser.email || '';
  adminControls.assignedToEmail = assignedUser.email || adminControls.assignedToEmail || '';
  adminControls.assignedToCrmUserId = adminControls.assignedToCrmUserId || assignedUser.crmUserId || '';
  if (adminControls.assignedToEmail) {
    adminControls.assignedToEmail = String(adminControls.assignedToEmail).toLowerCase().trim();
  }

  return ownership;
}

function normalizedClientBusinessKey(row = {}, data = row.data || {}) {
  const basic = data.basic || {};
  const name = basic.clientLegalName || basic.tradeName || '';
  const email = data.authorised?.email || data.coordinating?.email || '';
  const mobile = data.otp?.mobile || data.authorised?.mobile || data.coordinating?.mobile || '';
  const selectedLead = row.selectedLead?._id || row.selectedLead || '';
  return [name, email, mobile, selectedLead]
    .map((value) => String(value || '').trim().toLowerCase())
    .join('|');
}

function clientIntegrationIdentity(row = {}, data = row.data || {}) {
  const importMeta = data.importMeta || {};
  const uniqueId = readIdentityValue(importMeta.uniqueId);
  if (uniqueId) return { key: `unique:${uniqueId.toLowerCase()}`, query: { 'data.importMeta.uniqueId': uniqueId } };
  const ccpClientId = readIdentityValue(importMeta.ccpClientId);
  if (ccpClientId) return { key: `ccp:${ccpClientId.toLowerCase()}`, query: { 'data.importMeta.ccpClientId': ccpClientId } };
  const businessKey = normalizedClientBusinessKey(row, data);
  return {
    key: `business:${crypto.createHash('sha256').update(businessKey).digest('hex')}`,
    query: { integrationKey: `business:${crypto.createHash('sha256').update(businessKey).digest('hex')}` }
  };
}

async function backfillApprovalStatus() {
  await Promise.all([
    Client.updateMany({
      $or: [
        { 'adminControls.approvalStatus': { $exists: false } },
        { 'adminControls.approvalStatus': null },
        { 'adminControls.approvalStatus': '' },
        { 'adminControls.approvalStatus': /^pending$/i }
      ]
    }, { $set: { 'adminControls.approvalStatus': 'PENDING' } }),
    Client.updateMany({ 'adminControls.approvalStatus': /^approved$/i }, { $set: { 'adminControls.approvalStatus': 'APPROVED' } }),
    Client.updateMany({ 'adminControls.approvalStatus': /^rejected$/i }, { $set: { 'adminControls.approvalStatus': 'REJECTED' } })
  ]);
}

async function backfillFirstAnnualReturnYear() {
  const clients = await Client.find({
    'data.basic.firstAnnualReturnYear': { $exists: true, $nin: [null, ''] }
  }).select('data firstAnnualReturnYear');

  await Promise.all(clients.map(async (client) => {
    const firstAnnualReturnYear = String(client.data?.basic?.firstAnnualReturnYear || '').trim();
    if (!firstAnnualReturnYear || client.firstAnnualReturnYear === firstAnnualReturnYear) return;
    client.firstAnnualReturnYear = firstAnnualReturnYear;
    await client.save();
  }));
}

async function backfillOnboardingYear() {
  const clients = await Client.find({
    'data.basic.onboardingYear': { $exists: true, $nin: [null, ''] }
  }).select('data onboardingYear');

  await Promise.all(clients.map(async (client) => {
    const onboardingYear = String(client.data?.basic?.onboardingYear || '').trim();
    if (!onboardingYear || client.onboardingYear === onboardingYear) return;
    client.onboardingYear = onboardingYear;
    await client.save();
  }));
}

function normalizeClientOutput(client, viewer) {
  const plain = typeof client.toObject === 'function' ? client.toObject() : client;
  const data = plain.data || {};
  const importMeta = data.importMeta || {};
  const lead = plain.selectedLead || {};
  const email = data.authorised?.email || data.coordinating?.email || '';
  const mobile = data.otp?.mobile || data.authorised?.mobile || data.coordinating?.mobile || '';
  const name = data.basic?.clientLegalName || data.basic?.tradeName || lead.company || '';
  const rawUniqueId = importMeta.uniqueId || '';
  const rawLeadNumber = importMeta.leadNumber || lead.leadCode || '';
  const uniqueId = readIdentityValue(rawUniqueId);
  const leadNumber = readIdentityValue(rawLeadNumber);

  data.importMeta = {
    ...importMeta,
    uniqueId: rawUniqueId,
    leadNumber: rawLeadNumber
  };
  plain.data = data;
  if (!isAdmin(viewer) && plain.data?.cpcb) {
    plain.data.cpcb = { ...plain.data.cpcb };
    delete plain.data.cpcb.ceprPassword;
    delete plain.data.cpcb.loginPassword;
  }
  plain.clientIdentity = {
    key: uniqueId || leadNumber || email || mobile || name || String(plain._id || plain.id || ''),
    source: uniqueId ? 'uniqueId' : leadNumber ? 'leadNumber' : (email || mobile) ? 'contact' : name ? 'name' : 'id',
    uniqueId,
    leadNumber,
    email,
    mobile,
    name
  };
  plain.adminControls = {
    ...(plain.adminControls || {}),
    approvalStatus: normalizeApprovalStatus(plain.adminControls?.approvalStatus),
    visibilityStatus: plain.adminControls?.visibilityStatus || 'LIVE'
  };
  const assignedIdentity = buildAssignedUserIdentity(plain.adminControls.assignedTo, {
    name: plain.adminControls.assignedToText || data.importMeta?.assignedTo,
    email: plain.adminControls.assignedToEmail || data.importMeta?.assignedToEmail,
    crmUserId: plain.adminControls.assignedToCrmUserId || data.importMeta?.assignedToCrmUserId
  });
  if (assignedIdentity) {
    plain.adminControls.assignedTo = assignedIdentity;
    plain.adminControls.assignedToText = plain.adminControls.assignedToText || assignedIdentity.name || '';
  }
  return plain;
}

exports.listClients = async (req, res) => {
  await Promise.all([backfillApprovalStatus(), backfillFirstAnnualReturnYear(), backfillOnboardingYear()]);
  const query = await buildClientVisibilityQuery(req.user);
  const clients = await Client.find(query)
    .populate('selectedLead', 'leadCode company status emails mobileNo1 piboCategory eprCategory addressLine1 addressLine2 addressLine3 state city pinCode contactPerson designation')
    .populate('adminControls.assignedTo', 'name email crmUserId role avatarUrl team teamId managerId operationHeadId')
    .sort({ createdAt: -1 });
  res.json({ ok: true, clients: clients.map((client) => normalizeClientOutput(client, req.user)) });
};

exports.createClient = async (req, res) => {
  const workflowStatus = req.body.workflowStatus === 'submitted' ? 'submitted' : 'draft';
  logClientYearDebug('create:received', {
    selectedLead: req.body.selectedLead,
    workflowStatus,
    data: req.body.data || {},
    onboardingYear: req.body.onboardingYear,
    firstAnnualReturnYear: req.body.firstAnnualReturnYear
  });
  let result;
  try {
    result = await createClientRecord(req.body, req.user);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ ok: false, error: err.message || 'Unable to save client' });
  }
  const { client, crmSync } = result;
  logClientYearDebug('create:saved', {
    clientId: client._id,
    selectedLead: client.selectedLead,
    workflowStatus: client.workflowStatus,
    data: client.data || {},
    onboardingYear: client.onboardingYear,
    firstAnnualReturnYear: client.firstAnnualReturnYear
  });
  await auditQuotation(client, req.user, 'quotation_created', 'Quotation created', 'Quotation created');

  await client.populate('adminControls.assignedTo', 'name email crmUserId role avatarUrl team teamId managerId operationHeadId');
  res.status(201).json({ ok: true, client: normalizeClientOutput(client, req.user), crmSync });
};

async function createClientRecord(row, user) {
  const workflowStatus = row.workflowStatus === 'submitted' ? 'submitted' : 'draft';
  let data = applyRequestYearsToData(normalizeClientData(row.data || {}), row);
  const selectedLead = row.selectedLead || undefined;
  const importMeta = data.importMeta || {};
  const requestedAdminControls = {
    ...(row.adminControls || {}),
    assignedToText: row.adminControls?.assignedToText || importMeta.assignedTo || importMeta.assignedToText || '',
    assignedToEmail: row.adminControls?.assignedToEmail || importMeta.assignedToEmail || '',
    assignedToCrmUserId: row.adminControls?.assignedToCrmUserId || importMeta.assignedToCrmUserId || ''
  };
  const adminControls = (isAdmin(user) || !user)
    ? normalizeAdminControls(requestedAdminControls, { approvalStatus: 'PENDING', visibilityStatus: 'LIVE' })
    : createDefaultAdminControls(requestedAdminControls);
  const ownership = await enrichClientOwnership({
    adminControls,
    createdByName: row.createdByName,
    createdByEmail: row.createdByEmail,
    createdByCrmUserId: row.createdByCrmUserId
  }, user);
  data = applyAssignedNameToImportMeta(data, ownership.adminControls);

  if (workflowStatus === 'submitted' && !data?.basic?.clientLegalName) {
    const error = new Error('Client Legal Name is required before submit');
    error.statusCode = 400;
    throw error;
  }

  const identity = clientIntegrationIdentity(row, data);
  let client = await Client.findOne(identity.query);
  if (!client) {
    try {
      client = await Client.create({
        integrationKey: identity.key,
        selectedLead,
        adminControls: ownership.adminControls,
        data,
        workflowStatus,
        createdBy: user?._id,
        createdByName: ownership.createdByName,
        createdByEmail: ownership.createdByEmail,
        createdByCrmUserId: ownership.createdByCrmUserId
      });
    } catch (err) {
      if (err?.code !== 11000) throw err;
      client = await Client.findOne({ $or: [identity.query, { integrationKey: identity.key }] });
      if (!client) throw err;
    }
  }
  client = await forcePersistClientYears(client) || client;
  const pendingApproval = await upsertClientPendingApproval(client, readUserName(user));
  const crmSync = pendingApproval
    ? await syncPendingApprovalToCrm(pendingApproval, { action: 'upsert' })
    : { skipped: true, reason: 'Pending approval record not created' };
  return { client, crmSync };
}

exports.bulkCreateClients = async (req, res) => {
  const rows = Array.isArray(req.body.clients) ? req.body.clients : [];
  if (!rows.length) return res.status(400).json({ error: 'No clients provided' });

  const clients = [];
  const failures = [];

  for (let index = 0; index < rows.length; index += 1) {
    try {
      const { client, crmSync } = await createClientRecord(rows[index], req.user);
      await client.populate('adminControls.assignedTo', 'name email crmUserId role avatarUrl team teamId managerId operationHeadId');
      clients.push({ ...normalizeClientOutput(client), crmSync });
    } catch (err) {
      failures.push({
        row: index + 1,
        error: err.message || 'Unable to save client'
      });
    }
  }

  res.status(failures.length && !clients.length ? 400 : 201).json({
    ok: true,
    imported: clients.length,
    failed: failures.length,
    clients,
    failures
  });
};

exports.updateClient = async (req, res) => {
  const workflowStatus = req.body.workflowStatus === 'submitted' ? 'submitted' : 'draft';
  logClientYearDebug('update:received', {
    clientId: req.params.id,
    selectedLead: req.body.selectedLead,
    workflowStatus,
    data: req.body.data || {},
    onboardingYear: req.body.onboardingYear,
    firstAnnualReturnYear: req.body.firstAnnualReturnYear
  });
  let data = applyRequestYearsToData(normalizeClientData(req.body.data || {}), req.body);
  const selectedLead = req.body.selectedLead || undefined;

  if (workflowStatus === 'submitted' && !data?.basic?.clientLegalName) {
    return res.status(400).json({ error: 'Client Legal Name is required before submit' });
  }

  const requestedId = String(req.params.id || '').trim();
  let client = mongoose.Types.ObjectId.isValid(requestedId) ? await Client.findById(requestedId) : null;
  if (!client) {
    client = await Client.findOne({
      $or: [
        { 'data.importMeta.uniqueId': requestedId },
        { 'data.importMeta.ccpClientId': requestedId }
      ]
    });
  }
  if (!client) return res.status(404).json({ error: 'Client not found' });
  const previousApprovalStatus = client.adminControls?.approvalStatus;
  const adminControls = isAdmin(req.user)
    ? normalizeAdminControls(req.body.adminControls || {}, client.adminControls || {})
    : normalizeAdminControls({}, client.adminControls || {});
  const ownership = await enrichClientOwnership({
    adminControls,
    createdByName: client.createdByName,
    createdByEmail: client.createdByEmail,
    createdByCrmUserId: client.createdByCrmUserId
  }, req.user);
  data = applyAssignedNameToImportMeta(data, ownership.adminControls);

  client.selectedLead = selectedLead;
  client.adminControls = ownership.adminControls;
  client.data = data;
  client.workflowStatus = workflowStatus;
  client.createdByName = ownership.createdByName;
  client.createdByEmail = ownership.createdByEmail;
  client.createdByCrmUserId = ownership.createdByCrmUserId;
  await client.save();
  client = await forcePersistClientYears(client) || client;
  logClientYearDebug('update:saved', {
    clientId: client._id,
    selectedLead,
    workflowStatus: client.workflowStatus,
    data: client.data || {},
    onboardingYear: client.onboardingYear,
    firstAnnualReturnYear: client.firstAnnualReturnYear
  });
  const pendingApproval = await upsertClientPendingApproval(client, readUserName(req.user));
  await auditQuotation(client, req.user, 'quotation_updated', 'Quotation updated', 'Quotation details updated');
  const nextApprovalStatus = client.adminControls?.approvalStatus;
  if (nextApprovalStatus && nextApprovalStatus !== previousApprovalStatus) {
    const approvalType = nextApprovalStatus === 'APPROVED' ? 'quotation_approved' : nextApprovalStatus === 'REJECTED' ? 'quotation_rejected' : 'approval_pending';
    await auditQuotation(client, req.user, approvalType, nextApprovalStatus === 'PENDING' ? 'Quotation approval requested' : `Quotation ${nextApprovalStatus.toLowerCase()}`, `Quotation status changed from ${previousApprovalStatus || 'Not set'} to ${nextApprovalStatus}`, { oldValue: previousApprovalStatus || '', newValue: nextApprovalStatus });
  }
  const crmSync = pendingApproval
    ? await syncPendingApprovalToCrm(pendingApproval, { action: 'upsert' })
    : { skipped: true, reason: 'Pending approval record not created' };

  await client.populate('adminControls.assignedTo', 'name email crmUserId role avatarUrl team teamId managerId operationHeadId');
  res.json({ ok: true, client: normalizeClientOutput(client, req.user), crmSync });
};

exports.updateClientYears = async (req, res) => {
  const onboardingYear = String(req.body.onboardingYear || '').trim();
  const firstAnnualReturnYear = String(req.body.firstAnnualReturnYear || '').trim();
  const selectedLead = String(req.body.selectedLead || '').trim();
  const leadNumber = String(req.body.leadNumber || '').trim();
  const uniqueId = String(req.body.uniqueId || '').trim();
  const update = { $set: {}, $unset: {} };

  if (onboardingYear) {
    update.$set.onboardingYear = onboardingYear;
    update.$set['data.basic.onboardingYear'] = onboardingYear;
  } else {
    update.$unset.onboardingYear = '';
    update.$unset['data.basic.onboardingYear'] = '';
  }

  if (firstAnnualReturnYear) {
    update.$set.firstAnnualReturnYear = firstAnnualReturnYear;
    update.$set['data.basic.firstAnnualReturnYear'] = firstAnnualReturnYear;
  } else {
    update.$unset.firstAnnualReturnYear = '';
    update.$unset['data.basic.firstAnnualReturnYear'] = '';
  }

  if (!Object.keys(update.$set).length) delete update.$set;
  if (!Object.keys(update.$unset).length) delete update.$unset;

  logClientYearDebug('years:patch:received', {
    clientId: req.params.id,
    selectedLead,
    data: { basic: { onboardingYear, firstAnnualReturnYear } },
    onboardingYear,
    firstAnnualReturnYear
  });

  const relatedConditions = [{ _id: req.params.id }];
  if (mongoose.Types.ObjectId.isValid(selectedLead)) relatedConditions.push({ selectedLead });
  if (leadNumber) relatedConditions.push({ 'data.importMeta.leadNumber': leadNumber });
  if (uniqueId) relatedConditions.push({ 'data.importMeta.uniqueId': uniqueId });

  const relatedClients = await Client.find({ $or: relatedConditions }).select('_id selectedLead data.importMeta.leadNumber data.importMeta.uniqueId');
  const relatedIds = relatedClients.map((item) => item._id);
  if (relatedIds.length) {
    await Client.updateMany(
      { _id: { $in: relatedIds } },
      update,
      { strict: false }
    );
  }

  const client = await Client.findById(req.params.id)
    .populate('selectedLead', 'leadCode company status emails mobileNo1 piboCategory eprCategory addressLine1 addressLine2 addressLine3 state city pinCode contactPerson designation')
    .populate('adminControls.assignedTo', 'name email crmUserId role avatarUrl team teamId managerId operationHeadId');

  if (!client) return res.status(404).json({ error: 'Client not found' });

  logClientYearDebug('years:patch:saved', {
    clientId: client._id,
    selectedLead: client.selectedLead?._id || client.selectedLead || '',
    workflowStatus: client.workflowStatus,
    data: client.data || {},
    onboardingYear: client.onboardingYear,
    firstAnnualReturnYear: client.firstAnnualReturnYear,
    relatedClientIds: relatedIds.map((id) => String(id)),
    requestedClientId: req.params.id,
    leadNumber,
    uniqueId
  });

  res.json({
    ok: true,
    client: normalizeClientOutput(client, req.user),
    yearPatch: {
      requestedClientId: req.params.id,
      relatedClientIds: relatedIds.map((id) => String(id)),
      selectedLead,
      leadNumber,
      uniqueId,
      onboardingYear,
      firstAnnualReturnYear
    }
  });
};

function normalizeBulkClientIdentity(value) {
  return String(value || '').trim().replace(/^lead\s*number\s*:\s*/i, '').trim();
}

function normalizeFinancialYear(value) {
  const raw = String(value || '').trim().replace(/[–—]/g, '-');
  const match = raw.match(/^(\d{4})\s*-\s*(\d{2}|\d{4})$/);
  if (!match) return '';
  const start = Number(match[1]);
  const end = Number(match[2].length === 2 ? `${String(start).slice(0, 2)}${match[2]}` : match[2]);
  return end === start + 1 ? `${start}-${String(end).slice(-2)}` : '';
}

exports.bulkUpdateClientYears = async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ error: 'No annual return year rows provided' });

  const prepared = rows.map((row, index) => ({
    row: Number(row.row) || index + 2,
    identity: normalizeBulkClientIdentity(row.companyUniqueId || row.uniqueId || row.leadNumber),
    onboardingYear: normalizeFinancialYear(row.onboardingYear),
    firstAnnualReturnYear: normalizeFinancialYear(row.firstAnnualReturnYear)
  }));
  const identities = [...new Set(prepared.map((row) => row.identity).filter(Boolean))];
  const leads = await Lead.find({ leadCode: { $in: identities } }).select('_id leadCode').lean();
  const leadIdByCode = new Map(leads.map((lead) => [String(lead.leadCode).toUpperCase(), lead._id]));
  const clients = await Client.find({
    $or: [
      { selectedLead: { $in: leads.map((lead) => lead._id) } },
      { 'data.importMeta.leadNumber': { $in: identities } },
      { 'data.importMeta.uniqueId': { $in: identities } },
      { 'data.importMeta.ccpClientId': { $in: identities } }
    ]
  }).select('_id selectedLead data.importMeta').lean();
  const clientByIdentity = new Map();
  clients.forEach((client) => {
    const meta = client.data?.importMeta || {};
    [meta.leadNumber, meta.uniqueId, meta.ccpClientId].filter(Boolean).forEach((key) => clientByIdentity.set(String(key).trim().toUpperCase(), client));
    const lead = leads.find((item) => String(item._id) === String(client.selectedLead));
    if (lead?.leadCode) clientByIdentity.set(String(lead.leadCode).toUpperCase(), client);
  });

  const operations = [];
  const failures = [];
  const skipped = [];
  const updatedRows = [];
  prepared.forEach((row) => {
    if (!row.identity) return failures.push({ row: row.row, error: 'Company Unique ID is required' });
    if (!row.onboardingYear && !row.firstAnnualReturnYear) {
      return skipped.push({ row: row.row, reason: 'No valid year supplied; existing values were preserved' });
    }
    const client = clientByIdentity.get(row.identity.toUpperCase());
    if (!client) return failures.push({ row: row.row, error: `Client not found for ${row.identity}` });
    const fields = {};
    if (row.onboardingYear) {
      fields.onboardingYear = row.onboardingYear;
      fields['data.basic.onboardingYear'] = row.onboardingYear;
    }
    if (row.firstAnnualReturnYear) {
      fields.firstAnnualReturnYear = row.firstAnnualReturnYear;
      fields['data.basic.firstAnnualReturnYear'] = row.firstAnnualReturnYear;
    }
    operations.push({
      updateOne: {
        filter: { _id: client._id },
        update: { $set: fields }
      }
    });
    updatedRows.push({ row: row.row, clientId: String(client._id), companyUniqueId: row.identity });
  });
  if (operations.length) await Client.bulkWrite(operations, { ordered: false });

  return res.status(failures.length && !operations.length ? 400 : 200).json({
    ok: failures.length === 0,
    updated: operations.length,
    failed: failures.length,
    skipped: skipped.length,
    rows: updatedRows,
    failures,
    skippedRows: skipped
  });
};

async function findClientByKey(value) {
  const key = String(value || '').trim();
  if (mongoose.Types.ObjectId.isValid(key)) {
    const byId = await Client.findById(key);
    if (byId) return byId;
  }
  return Client.findOne({ $or: [
    { integrationKey: key },
    { 'data.importMeta.uniqueId': key },
    { 'data.importMeta.leadNumber': key },
    { 'data.importMeta.ccpClientId': key }
  ] });
}

function validatePurchaseOrderConfirmation(input) {
  const po = stripDangerousKeys(input || {});
  if (!['yes', 'no'].includes(po.mode)) return 'Please select Yes or No for PO Received.';
  if (po.mode === 'no') {
    if (!(Array.isArray(po.approvalFiles) && po.approvalFiles.length) && !String(po.approvalNote || '').trim()) {
      return 'Upload special approval proof or enter the approval email/note.';
    }
    return '';
  }
  if (!Array.isArray(po.rows) || !po.rows.length) return 'Add at least one purchase order year.';
  const years = new Set();
  for (const row of po.rows) {
    const year = normalizeFinancialYear(row?.fyYear);
    if (!year || !String(row?.poNumber || '').trim() || !row?.file?.name || !row?.file?.url || !Array.isArray(row?.service) || !row.service.length) {
      return 'Every PO row requires FY Year, PO Number, PO Upload, and at least one Service.';
    }
    if (years.has(year)) return `Duplicate FY Year ${year} is not allowed.`;
    years.add(year);
  }
  return '';
}

function annualYearUnlocked(annualReturn, annualYear) {
  const filings = annualReturn?.filings || {};
  const direct = filings[annualYear]?.draft?.purchaseOrderConfirmation;
  const confirmations = [direct, ...Object.values(filings).map((filing) => filing?.draft?.purchaseOrderConfirmation)].filter(Boolean);
  if (confirmations.some((po) => po.mode === 'no' && po.confirmed && ((po.approvalFiles || []).length || String(po.approvalNote || '').trim()))) return true;
  return confirmations.some((po) => po.mode === 'yes' && po.confirmed && (po.rows || []).some((row) => row.fyYear === annualYear));
}

exports.getAnnualReturn = async (req, res) => {
  const client = await findClientByKey(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  const canonical = await AnnualReturn.findOne({ client: client._id }).lean();
  const legacy = client.data?.annualReturn || {};
  const annualReturn = canonical || { client: client._id, ...legacy, filings: legacy.filings || {} };
  return res.json({ ok: true, client: normalizeClientOutput(client, req.user), annualReturn });
};

exports.saveAnnualReturn = async (req, res) => {
  const client = await findClientByKey(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  const annualYear = normalizeFinancialYear(req.body?.annualYear);
  if (!annualYear) return res.status(400).json({ error: 'A valid annualYear is required' });
  const incomingDraft = stripDangerousKeys(req.body?.draft || {});
  if (incomingDraft.purchaseOrderConfirmation) {
    const validationError = validatePurchaseOrderConfirmation(incomingDraft.purchaseOrderConfirmation);
    if (validationError) return res.status(400).json({ error: validationError });
    incomingDraft.purchaseOrderConfirmation = {
      ...incomingDraft.purchaseOrderConfirmation,
      confirmed: true,
      savedAt: new Date(),
      savedBy: req.user._id
    };
  }
  const existingAnnual = client.data?.annualReturn || {};
  const existingFiling = existingAnnual.filings?.[annualYear] || {};
  const filing = {
    ...existingFiling,
    activeTab: req.body.activeTab || existingFiling.activeTab || 'basic',
    activeSection: req.body.activeSection || existingFiling.activeSection || '',
    status: req.body.status || existingFiling.status || 'draft',
    draft: { ...(existingFiling.draft || {}), ...incomingDraft },
    updatedAt: new Date(),
    updatedBy: req.user._id
  };
  const filings = { ...(existingAnnual.filings || {}), [annualYear]: filing };
  client.data = { ...(client.data || {}), annualReturn: { ...existingAnnual, filings } };
  client.markModified('data');
  await client.save();

  const canonical = await AnnualReturn.findOneAndUpdate(
    { client: client._id },
    { $set: { [`filings.${annualYear}`]: filing, updatedBy: req.user._id }, $setOnInsert: { client: client._id } },
    { new: true, upsert: true, runValidators: true }
  );
  return res.json({ ok: true, filing, annualReturn: canonical });
};

exports.getAnnualYearAccess = async (req, res) => {
  const client = await findClientByKey(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  const annualYear = normalizeFinancialYear(req.params.annualYear);
  if (!annualYear) return res.status(400).json({ error: 'Invalid annual year' });
  const canonical = await AnnualReturn.findOne({ client: client._id }).lean();
  const source = canonical || client.data?.annualReturn || {};
  const unlocked = annualYearUnlocked(source, annualYear);
  return res.status(unlocked ? 200 : 403).json({ ok: unlocked, unlocked, error: unlocked ? undefined : 'Frozen — PO details pending' });
};

exports.backfillApprovalStatus = backfillApprovalStatus;
exports.normalizeApprovalStatus = normalizeApprovalStatus;
exports.normalizeClientOutput = normalizeClientOutput;
exports._test = { normalizedClientBusinessKey, clientIntegrationIdentity, enrichClientOwnership, normalizeClientData, applyRequestYearsToData, normalizeBulkClientIdentity, normalizeFinancialYear, validatePurchaseOrderConfirmation, annualYearUnlocked, stripDangerousKeys };
