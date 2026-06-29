const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { buildLeadVisibilityQuery } = require('../utils/visibilityScope');

const REQUIRED_FIELDS = ['status', 'company', 'piboCategory', 'servicesOffered', 'addressLine1', 'state', 'city', 'pinCode'];
const LEAD_CODE_PREFIX = 'ATPL-LEAD-';

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

function normalizeLeadOutput(lead) {
  const plain = typeof lead?.toObject === 'function' ? lead.toObject() : { ...(lead || {}) };
  const assignedTo = buildAssignedUserIdentity(plain.assignedTo, {
    name: plain.assignedToText,
    email: plain.assignedToEmail,
    crmUserId: plain.assignedToCrmUserId
  });

  return {
    ...plain,
    assignedTo: assignedTo || plain.assignedTo,
    assignedToText: plain.assignedToText || assignedTo?.name || ''
  };
}

function cleanBody(body) {
  const data = {};
  [
    'communicationMode',
    'sourceLeadId',
    'status',
    'company',
    'industryType',
    'eprCategory',
    'piboCategory',
    'servicesOffered',
    'addressLine1',
    'addressLine2',
    'addressLine3',
    'landmark',
    'state',
    'city',
    'pinCode',
    'existingClient',
    'website',
    'salutation',
    'contactPerson',
    'designation',
    'emails',
    'emailsSentCount',
    'lastEmailSent',
    'mobileNo1',
    'mobileNo2',
    'businessCardUrl',
    'referredBy',
    'source',
    'notes',
    'assignedTo',
    'assignedToText',
    'assignedToEmail',
    'assignedToCrmUserId',
    'assignedBy',
    'importedCreatedBy',
    'createdByEmail',
    'createdByCrmUserId',
    'leadDate',
    'nextFollowUpDate',
    'nextFollowUpTime',
    'followUpRemarks',
    'importedCreatedAt',
    'importedUpdatedAt',
    'complianceHealthReport',
    'workflowStatus'
  ].forEach((key) => {
    if (body[key] !== undefined) {
      const rawValue = key === 'assignedTo' ? normalizeAssignedUserInput(body[key]).assignedTo : body[key];
      const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
      if (key === 'complianceHealthReport') {
        data.complianceHealthReport = value && typeof value === 'object'
          ? { ...value, submittedAt: value.submittedAt || (value.reviewedConfirmation ? new Date() : undefined) }
          : undefined;
        return;
      }
      if (key === 'assignedTo' && body[key] && typeof body[key] === 'object') {
        const assignedInput = normalizeAssignedUserInput(body[key]);
        data.assignedToText = data.assignedToText || String(assignedInput.assignedToText || '').trim();
        data.assignedToEmail = data.assignedToEmail || String(assignedInput.assignedToEmail || '').toLowerCase().trim();
        data.assignedToCrmUserId = data.assignedToCrmUserId || String(assignedInput.assignedToCrmUserId || '').trim();
      }
      if (key === 'assignedTo' && !value) return;
      if (key === 'assignedTo' && !mongoose.Types.ObjectId.isValid(String(value))) {
        data.assignedToText = data.assignedToText || String(value).trim();
        data.assignedToCrmUserId = data.assignedToCrmUserId || String(value).trim();
        return;
      }
      data[key] = key === 'emailsSentCount' ? Number(value) || 0 : value;
    }
  });

  if (data.assignedToEmail) data.assignedToEmail = String(data.assignedToEmail).toLowerCase().trim();
  if (data.createdByEmail) data.createdByEmail = String(data.createdByEmail).toLowerCase().trim();
  return data;
}

function validateSubmittedLead(data) {
  const missing = REQUIRED_FIELDS.filter((field) => !data[field]);
  if (missing.length) return `Missing required fields: ${missing.join(', ')}`;
  return '';
}

async function getNextLeadCode() {
  const latest = await Lead.findOne({ leadCode: { $exists: true, $ne: '' } })
    .sort({ leadCode: -1 })
    .select('leadCode')
    .lean();
  const latestNumber = Number.parseInt(String(latest?.leadCode || '').replace(LEAD_CODE_PREFIX, ''), 10) || 0;
  return `${LEAD_CODE_PREFIX}${String(latestNumber + 1).padStart(4, '0')}`;
}

async function createLeadRecord(rawBody, userId) {
  const data = cleanBody(rawBody);
  await enrichLeadOwnership(data, userId);
  data.workflowStatus = data.workflowStatus === 'submitted' ? 'submitted' : 'draft';

  if (data.workflowStatus === 'submitted') {
    const error = validateSubmittedLead(data);
    if (error) {
      const validationError = new Error(error);
      validationError.statusCode = 400;
      throw validationError;
    }
  }

  return Lead.create({ ...data, leadCode: await getNextLeadCode(), createdBy: userId });
}

async function enrichLeadOwnership(data, user) {
  if (user) {
    data.createdByEmail = data.createdByEmail || user.email || '';
    data.createdByCrmUserId = data.createdByCrmUserId || user.crmUserId || '';
    data.importedCreatedBy = data.importedCreatedBy || user.name || user.email || '';
  }

  if (!data.assignedTo) {
    if (data.assignedToText && !data.assignedToEmail && String(data.assignedToText).includes('@')) {
      data.assignedToEmail = String(data.assignedToText).toLowerCase().trim();
    }
    return;
  }

  const assignedUser = await User.findById(data.assignedTo)
    .select('name email crmUserId')
    .lean();
  if (!assignedUser) return;

  data.assignedToText = data.assignedToText || assignedUser.name || assignedUser.email || '';
  data.assignedToEmail = data.assignedToEmail || assignedUser.email || '';
  data.assignedToCrmUserId = data.assignedToCrmUserId || assignedUser.crmUserId || '';
}

exports.listLeads = async (req, res) => {
  const query = await buildLeadVisibilityQuery(req.user);
  const leads = await Lead.find(query).populate('assignedTo', 'name email crmUserId avatarUrl role team teamId managerId operationHeadId').sort({ leadCode: 1, createdAt: 1 });
  res.json({ ok: true, leads: leads.map(normalizeLeadOutput) });
};

exports.createLead = async (req, res) => {
  try {
    const lead = await createLeadRecord(req.body, req.user);
    await lead.populate('assignedTo', 'name email crmUserId avatarUrl role team teamId managerId operationHeadId');
    res.status(201).json({ ok: true, lead: normalizeLeadOutput(lead) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Unable to save lead' });
  }
};

exports.updateLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const data = cleanBody(req.body);
    await enrichLeadOwnership(data, req.user);
    data.workflowStatus = data.workflowStatus === 'submitted' ? 'submitted' : (data.workflowStatus || lead.workflowStatus || 'draft');

    if (data.workflowStatus === 'submitted') {
      const error = validateSubmittedLead({ ...lead.toObject(), ...data });
      if (error) return res.status(400).json({ error });
    }

    Object.assign(lead, data);
    await lead.save();
    await lead.populate('assignedTo', 'name email crmUserId avatarUrl role team teamId managerId operationHeadId');
    res.json({ ok: true, lead: normalizeLeadOutput(lead) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Unable to update lead' });
  }
};

exports.bulkCreateLeads = async (req, res) => {
  const rows = Array.isArray(req.body.leads) ? req.body.leads : [];
  if (!rows.length) return res.status(400).json({ error: 'No leads provided' });

  const leads = [];
  const failures = [];

  for (let index = 0; index < rows.length; index += 1) {
    try {
      const lead = await createLeadRecord(rows[index], req.user);
      await lead.populate('assignedTo', 'name email crmUserId avatarUrl role team teamId managerId operationHeadId');
      leads.push(normalizeLeadOutput(lead));
    } catch (err) {
      failures.push({
        row: index + 1,
        error: err.message || 'Unable to save lead'
      });
    }
  }

  res.status(failures.length && !leads.length ? 400 : 201).json({
    ok: failures.length === 0,
    imported: leads.length,
    failed: failures.length,
    leads,
    failures
  });
};
