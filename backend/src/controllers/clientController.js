const mongoose = require('mongoose');
const Client = require('../models/Client');
const User = require('../models/User');
const { readUserName, upsertClientPendingApproval } = require('../utils/pendingApproval');
const { syncPendingApprovalToCrm } = require('../utils/crmPendingApprovalSync');
const { buildClientVisibilityQuery } = require('../utils/visibilityScope');

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
    topLevelFirstAnnualReturnYear: details.firstAnnualReturnYear || ''
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

  if (!adminControls.assignedTo) {
    if (adminControls.assignedToText && !adminControls.assignedToEmail && String(adminControls.assignedToText).includes('@')) {
      adminControls.assignedToEmail = String(adminControls.assignedToText).toLowerCase().trim();
    }
    return ownership;
  }

  if (!mongoose.Types.ObjectId.isValid(String(adminControls.assignedTo))) {
    adminControls.assignedToText = adminControls.assignedToText || String(adminControls.assignedTo).trim();
    adminControls.assignedToCrmUserId = adminControls.assignedToCrmUserId || String(adminControls.assignedTo).trim();
    delete adminControls.assignedTo;
    return ownership;
  }

  const assignedUser = await User.findById(adminControls.assignedTo)
    .select('name email crmUserId')
    .lean();
  if (!assignedUser) return ownership;

  adminControls.assignedToText = adminControls.assignedToText || assignedUser.name || assignedUser.email || '';
  adminControls.assignedToEmail = adminControls.assignedToEmail || assignedUser.email || '';
  adminControls.assignedToCrmUserId = adminControls.assignedToCrmUserId || assignedUser.crmUserId || '';
  if (adminControls.assignedToEmail) {
    adminControls.assignedToEmail = String(adminControls.assignedToEmail).toLowerCase().trim();
  }

  return ownership;
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

function normalizeClientOutput(client) {
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
  res.json({ ok: true, clients: clients.map(normalizeClientOutput) });
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
  let data = applyRequestYearsToData(normalizeClientData(req.body.data || {}), req.body);
  const selectedLead = req.body.selectedLead || undefined;
  const adminControls = createDefaultAdminControls(req.body.adminControls || {});
  const ownership = await enrichClientOwnership({ adminControls }, req.user);
  data = applyAssignedNameToImportMeta(data, ownership.adminControls);

  if (workflowStatus === 'submitted' && !data?.basic?.clientLegalName) {
    return res.status(400).json({ error: 'Client Legal Name is required before submit' });
  }

  let client = await Client.create({
    selectedLead,
    adminControls: ownership.adminControls,
    data,
    workflowStatus,
    createdBy: req.user?._id,
    createdByName: ownership.createdByName,
    createdByEmail: ownership.createdByEmail,
    createdByCrmUserId: ownership.createdByCrmUserId
  });
  client = await forcePersistClientYears(client) || client;
  logClientYearDebug('create:saved', {
    clientId: client._id,
    selectedLead,
    workflowStatus: client.workflowStatus,
    data: client.data || {},
    onboardingYear: client.onboardingYear,
    firstAnnualReturnYear: client.firstAnnualReturnYear
  });
  const pendingApproval = await upsertClientPendingApproval(client, readUserName(req.user));
  const crmSync = pendingApproval
    ? await syncPendingApprovalToCrm(pendingApproval, { action: 'upsert' })
    : { skipped: true, reason: 'Pending approval record not created' };

  await client.populate('adminControls.assignedTo', 'name email crmUserId role avatarUrl team teamId managerId operationHeadId');
  res.status(201).json({ ok: true, client: normalizeClientOutput(client), crmSync });
};

async function createClientRecord(row, user) {
  const workflowStatus = row.workflowStatus === 'submitted' ? 'submitted' : 'draft';
  let data = applyRequestYearsToData(normalizeClientData(row.data || {}), row);
  const selectedLead = row.selectedLead || undefined;
  const adminControls = createDefaultAdminControls(row.adminControls || {});
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

  let client = await Client.create({
    selectedLead,
    adminControls: ownership.adminControls,
    data,
    workflowStatus,
    createdBy: user?._id,
    createdByName: ownership.createdByName,
    createdByEmail: ownership.createdByEmail,
    createdByCrmUserId: ownership.createdByCrmUserId
  });
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
    ok: failures.length === 0,
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

  let client = await Client.findById(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  const adminControls = normalizeAdminControls(req.body.adminControls || {}, client.adminControls || {});
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
  const crmSync = pendingApproval
    ? await syncPendingApprovalToCrm(pendingApproval, { action: 'upsert' })
    : { skipped: true, reason: 'Pending approval record not created' };

  await client.populate('adminControls.assignedTo', 'name email crmUserId role avatarUrl team teamId managerId operationHeadId');
  res.json({ ok: true, client: normalizeClientOutput(client), crmSync });
};

exports.backfillApprovalStatus = backfillApprovalStatus;
exports.normalizeApprovalStatus = normalizeApprovalStatus;
exports.normalizeClientOutput = normalizeClientOutput;
