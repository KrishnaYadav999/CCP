const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { buildLeadVisibilityQuery } = require('../utils/visibilityScope');
const { recordAudit } = require('./leadHistoryController');
const { PUBLIC_USER_FIELDS, resolveLeadUser, resolveImportedUser, userFields, publicUser } = require('../utils/leadUserIdentity');
const { canonicalizeBulkRow, normalizeBulkDates } = require('../utils/bulkLeadImport');

const REQUIRED_FIELDS = ['status', 'company', 'piboParent', 'piboCategory', 'servicesOffered', 'addressLine1', 'state', 'city', 'pinCode'];
const LEAD_CODE_PREFIX = 'ATPL-';

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
  const role = String(source.role || fallback.role || '').trim();
  const team = String(source.team || fallback.team || '').trim();

  if (!id && !crmUserId && !email && !name) return null;

  return {
    id,
    _id: id,
    ccpUserId: id,
    crmUserId,
    name,
    email,
    role,
    team
  };
}

function normalizeLeadOutput(lead) {
  const plain = typeof lead?.toObject === 'function' ? lead.toObject() : { ...(lead || {}) };
  const storedCode = String(plain.leadCode || '').trim();
  const sourceCodeMatch = String(plain.sourceLeadId || '').trim().match(/^ATPL-(?:LEAD-)?(\d{4})$/i);
  const displayLeadCode = /^ATPL-\d{4}$/i.test(storedCode)
    ? storedCode.toUpperCase()
    : sourceCodeMatch
      ? `ATPL-${sourceCodeMatch[1]}`
      : storedCode;
  const assignedTo = buildAssignedUserIdentity(plain.assignedTo, {
    name: plain.assignedToText,
    email: plain.assignedToEmail,
    crmUserId: plain.assignedToCrmUserId
  });
  const createdBy = publicUser(plain.createdBy, { name: plain.createdByName || plain.importedCreatedBy, email: plain.createdByEmail, crmUserId: plain.createdByCrmUserId });
  const updatedBy = publicUser(plain.updatedBy, { name: plain.updatedByName, email: plain.updatedByEmail, crmUserId: plain.updatedByCrmUserId });
  const closedBy = publicUser(plain.closedBy, { name: plain.closedByText, email: plain.closedByEmail, crmUserId: plain.closedByCrmUserId });
  const importedBy = publicUser(plain.importedBy, { name: plain.importedByName, email: plain.importedByEmail });

  return {
    ...plain,
    leadCode: displayLeadCode,
    assignedTo: assignedTo || plain.assignedTo,
    assignedToText: plain.assignedToText || assignedTo?.name || '',
    createdBy: createdBy || plain.createdBy,
    updatedBy: updatedBy || plain.updatedBy,
    closedBy: closedBy || plain.closedBy,
    closedByText: plain.closedByText || closedBy?.name || '',
    importedBy: importedBy || plain.importedBy
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
    'piboParent',
    'piboCategory',
    'servicesOffered',
    'addressLine1',
    'addressLine2',
    'addressLine3',
    'landmark',
    'state',
    'city',
    'pinCode',
    'gstNumber',
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
    'assignedByName',
    'assignedByEmail',
    'assignedByUserId',
    'assignedAt',
    'closedBy',
    'closedByText',
    'closedByEmail',
    'closedByCrmUserId',
    'importedCreatedBy',
    'createdByEmail',
    'createdByCrmUserId',
    'leadDate',
    'nextFollowUpDate',
    'nextFollowUpTime',
    'followUpRemarks',
    'importedCreatedAt',
    'importedUpdatedAt',
    'importedBy',
    'importedByName',
    'importedByEmail',
    'importedAt',
    'complianceHealthReport',
    'workflowStatus'
  ].forEach((key) => {
    if (body[key] !== undefined) {
      const rawValue = ['assignedTo', 'closedBy'].includes(key) ? normalizeAssignedUserInput(body[key]).assignedTo : body[key];
      const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
      if (key === 'complianceHealthReport') {
        data.complianceHealthReport = value && typeof value === 'object'
          ? { ...value, submittedAt: value.submittedAt || (value.reviewedConfirmation ? new Date() : undefined) }
          : undefined;
        return;
      }
      if (['assignedTo', 'closedBy'].includes(key) && body[key] && typeof body[key] === 'object') {
        const assignedInput = normalizeAssignedUserInput(body[key]);
        const textPrefix = key === 'assignedTo' ? 'assignedTo' : 'closedBy';
        data[`${textPrefix}Text`] = data[`${textPrefix}Text`] || String(assignedInput.assignedToText || '').trim();
        data[`${textPrefix}Email`] = data[`${textPrefix}Email`] || String(assignedInput.assignedToEmail || '').toLowerCase().trim();
        data[`${textPrefix}CrmUserId`] = data[`${textPrefix}CrmUserId`] || String(assignedInput.assignedToCrmUserId || '').trim();
      }
      if (['assignedTo', 'closedBy'].includes(key) && !value) {
        data[key] = null;
        return;
      }
      if (['assignedTo', 'closedBy'].includes(key) && !mongoose.Types.ObjectId.isValid(String(value))) {
        const textPrefix = key === 'assignedTo' ? 'assignedTo' : 'closedBy';
        data[`${textPrefix}Text`] = data[`${textPrefix}Text`] || String(value).trim();
        data[`${textPrefix}CrmUserId`] = data[`${textPrefix}CrmUserId`] || String(value).trim();
        return;
      }
      data[key] = key === 'emailsSentCount' ? Number(value) || 0 : value;
    }
  });

  if (data.assignedToEmail) data.assignedToEmail = String(data.assignedToEmail).toLowerCase().trim();
  if (data.assignedByEmail) data.assignedByEmail = String(data.assignedByEmail).toLowerCase().trim();
  if (data.createdByEmail) data.createdByEmail = String(data.createdByEmail).toLowerCase().trim();
  if (data.importedByEmail) data.importedByEmail = String(data.importedByEmail).toLowerCase().trim();
  if (data.closedByEmail) data.closedByEmail = String(data.closedByEmail).toLowerCase().trim();
  return data;
}

function actorFields(prefix, user) {
  return {
    [prefix]: user?._id,
    [`${prefix}Name`]: user?.name || user?.email || '',
    [`${prefix}Email`]: user?.email || '',
    [`${prefix}CrmUserId`]: user?.crmUserId || ''
  };
}

function assignmentActorFields(user, at = new Date()) {
  return { assignedBy: user?.name || user?.email || '', assignedByEmail: user?.email || '', assignedByUserId: user?._id, assignedAt: at };
}

function hasIdentityInput(body, prefix) {
  return [prefix, `${prefix}Text`, `${prefix}Email`, `${prefix}CrmUserId`].some((key) => Object.prototype.hasOwnProperty.call(body || {}, key));
}

async function applySelectedUser(data, body, prefix) {
  if (!hasIdentityInput(body, prefix)) return false;
  const raw = body?.[prefix];
  const explicitlyCleared = raw === '' || raw === null;
  if (explicitlyCleared) {
    data[prefix] = null;
    data[prefix === 'assignedTo' ? 'assignedToText' : `${prefix}Text`] = '';
    data[`${prefix}Email`] = '';
    data[`${prefix}CrmUserId`] = '';
    return true;
  }
  const { user } = await resolveLeadUser(body, prefix, User, { activeOnly: true });
  if (!user) {
    const error = new Error(`${prefix === 'closedBy' ? 'Lead Closed By' : 'Assignee'} must be an active CCP user`);
    error.statusCode = 400;
    throw error;
  }
  Object.assign(data, userFields(prefix, user));
  return true;
}

function validateSubmittedLead(data) {
  const missing = REQUIRED_FIELDS.filter((field) => !data[field]);
  if (missing.length) return `Missing required fields: ${missing.join(', ')}`;
  return '';
}

async function getNextLeadCode() {
  const candidates = await Promise.all([
    Lead.findOne({ leadCode: /^ATPL-\d{4}$/ }).sort({ leadCode: -1 }).select('leadCode').lean(),
    Lead.findOne({ leadCode: /^ATPL-LEAD-\d{4}$/ }).sort({ leadCode: -1 }).select('leadCode').lean(),
    Lead.findOne({ sourceLeadId: /^ATPL-\d{4}$/ }).sort({ sourceLeadId: -1 }).select('sourceLeadId').lean(),
    Lead.findOne({ sourceLeadId: /^ATPL-LEAD-\d{4}$/ }).sort({ sourceLeadId: -1 }).select('sourceLeadId').lean()
  ]);
  const numberFrom = (lead) => Number.parseInt(String(lead?.leadCode || lead?.sourceLeadId || '').match(/(\d{4})$/)?.[1], 10) || 0;
  const latestNumber = Math.max(0, ...candidates.map(numberFrom));
  return `${LEAD_CODE_PREFIX}${String(latestNumber + 1).padStart(4, '0')}`;
}

async function applyBulkAuditIdentity(data, rawBody, actor) {
  const assignedDisplay = String(rawBody.assignedByName || rawBody.assignedBy || '').trim();
  if (assignedDisplay || rawBody.assignedByEmail || rawBody.assignedByUserId) {
    const assignedUser = await resolveImportedUser({ name: assignedDisplay, email: rawBody.assignedByEmail, id: rawBody.assignedByUserId, crmUserId: rawBody.assignedByCrmUserId }, User);
    data.assignedBy = assignedDisplay || assignedUser?.name || assignedUser?.email || '';
    data.assignedByName = assignedUser?.name || assignedDisplay;
    data.assignedByEmail = assignedUser?.email || String(rawBody.assignedByEmail || '').toLowerCase().trim();
    if (assignedUser?._id) data.assignedByUserId = assignedUser._id;
  }
  const creatorDisplay = String(rawBody.createdByName || rawBody.importedCreatedBy || '').trim();
  const creator = creatorDisplay || rawBody.createdByEmail || rawBody.createdByCrmUserId || rawBody.createdBy
    ? await resolveImportedUser({ name: creatorDisplay, email: rawBody.createdByEmail, crmUserId: rawBody.createdByCrmUserId, id: rawBody.createdBy }, User)
    : null;
  if (creatorDisplay || creator) {
    data.importedCreatedBy = creatorDisplay || creator.name || creator.email || '';
    data.createdByName = creator?.name || creatorDisplay;
    data.createdByEmail = creator?.email || String(rawBody.createdByEmail || '').toLowerCase().trim();
    data.createdByCrmUserId = creator?.crmUserId || String(rawBody.createdByCrmUserId || '').trim();
    if (creator?._id) data.createdBy = creator._id;
  } else Object.assign(data, actorFields('createdBy', actor));
  data.importedBy = actor?._id;
  data.importedByName = actor?.name || actor?.email || '';
  data.importedByEmail = actor?.email || '';
  data.importedAt = new Date();
  if (data.importedCreatedAt && !Number.isNaN(new Date(data.importedCreatedAt).getTime())) data.createdAt = new Date(data.importedCreatedAt);
}

async function createLeadRecord(rawBody, actor, { bulk = false } = {}) {
  const data = cleanBody(rawBody);
  if (!bulk) {
    for (const field of ['assignedBy', 'assignedByName', 'assignedByEmail', 'assignedByUserId', 'assignedAt', 'importedBy', 'importedByName', 'importedByEmail', 'importedAt']) delete data[field];
  }
  if (bulk) {
    if (rawBody.assignedToText || rawBody.assignedToEmail || rawBody.assignedToCrmUserId || rawBody.assignedTo) {
      const assigned = await resolveImportedUser({ name: rawBody.assignedToText || rawBody.assignedTo, email: rawBody.assignedToEmail, crmUserId: rawBody.assignedToCrmUserId, id: rawBody.assignedTo }, User);
      if (assigned) Object.assign(data, userFields('assignedTo', assigned));
      else data.assignedTo = null;
    } else data.assignedTo = null;
  } else await applySelectedUser(data, rawBody, 'assignedTo');
  await applySelectedUser(data, rawBody, 'closedBy');
  if (bulk) await applyBulkAuditIdentity(data, rawBody, actor);
  else Object.assign(data, actorFields('createdBy', actor));
  if (data.assignedTo && !bulk) Object.assign(data, assignmentActorFields(actor));
  if (data.closedBy) data.closedAt = new Date();
  data.importedCreatedBy = data.importedCreatedBy || actor?.name || actor?.email || '';
  data.workflowStatus = data.workflowStatus === 'submitted' ? 'submitted' : 'draft';

  if (data.workflowStatus === 'submitted') {
    const error = validateSubmittedLead(data);
    if (error) {
      const validationError = new Error(error);
      validationError.statusCode = 400;
      throw validationError;
    }
  }

  if (data.sourceLeadId) {
    const existing = await Lead.findOne({ sourceLeadId: data.sourceLeadId });
    if (existing) {
      const safeData = { ...data };
      for (const field of ['createdBy', 'createdByName', 'createdByEmail', 'createdByCrmUserId', 'importedCreatedBy']) delete safeData[field];
      Object.assign(existing, safeData);
      await existing.save();
      return existing;
    }
  }
  return Lead.create({ ...data, leadCode: await getNextLeadCode() });
}

exports.listLeads = async (req, res) => {
  const query = await buildLeadVisibilityQuery(req.user);
  const [leads, nextLeadCode] = await Promise.all([
    Lead.find(query)
      .populate('assignedTo createdBy updatedBy closedBy importedBy', PUBLIC_USER_FIELDS)
      .sort({ leadCode: 1, createdAt: 1 }),
    getNextLeadCode()
  ]);
  res.json({ ok: true, leads: leads.map(normalizeLeadOutput), nextLeadCode });
};

exports.createLead = async (req, res) => {
  try {
    const lead = await createLeadRecord(req.body, req.user);
    await recordAudit({ lead, type: 'lead_created', title: 'Lead created', description: `Lead ${lead.leadCode} created`, user: req.user });
    if (lead.assignedTo) await recordAudit({ lead, type: 'lead_assigned', title: 'Lead assigned', description: `Lead assigned to ${lead.assignedToText || lead.assignedToEmail}`, user: req.user, metadata: { changedFields: ['assignedTo'], newAssignee: { id: String(lead.assignedTo), name: lead.assignedToText || '', email: lead.assignedToEmail || '' } } });
    if (lead.closedBy) await recordAudit({ lead, type: 'lead_closed', title: 'Lead closed', description: `Lead closed by ${lead.closedByText || lead.closedByEmail}`, user: req.user, metadata: { changedFields: ['closedBy'], newCloser: { id: String(lead.closedBy), name: lead.closedByText || '', email: lead.closedByEmail || '' } } });
    await lead.populate('assignedTo createdBy updatedBy closedBy importedBy', PUBLIC_USER_FIELDS);
    res.status(201).json({ ok: true, lead: normalizeLeadOutput(lead) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Unable to save lead' });
  }
};

exports.updateLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const before = lead.toObject();
    const data = cleanBody(req.body);
    for (const protectedField of ['importedCreatedBy', 'createdByEmail', 'createdByCrmUserId', 'importedCreatedAt', 'importedUpdatedAt', 'assignedBy', 'assignedByName', 'assignedByEmail', 'assignedByUserId', 'assignedAt', 'importedBy', 'importedByName', 'importedByEmail', 'importedAt']) delete data[protectedField];
    const assignmentRequested = await applySelectedUser(data, req.body, 'assignedTo');
    const closureRequested = await applySelectedUser(data, req.body, 'closedBy');
    data.workflowStatus = data.workflowStatus === 'submitted' ? 'submitted' : (data.workflowStatus || lead.workflowStatus || 'draft');

    if (data.workflowStatus === 'submitted') {
      const error = validateSubmittedLead({ ...lead.toObject(), ...data });
      if (error) return res.status(400).json({ error });
    }

    const previousAssigneeId = String(before.assignedTo || '');
    const nextAssigneeId = assignmentRequested ? String(data.assignedTo || '') : previousAssigneeId;
    const assigneeChanged = assignmentRequested && previousAssigneeId !== nextAssigneeId;
    if (assigneeChanged) Object.assign(data, assignmentActorFields(req.user));

    const previousCloserId = String(before.closedBy || '');
    const nextCloserId = closureRequested ? String(data.closedBy || '') : previousCloserId;
    const closerChanged = closureRequested && previousCloserId !== nextCloserId;
    if (closerChanged && nextCloserId && !before.closedAt) data.closedAt = new Date();
    if (closerChanged && !nextCloserId) data.closedAt = null;
    Object.assign(data, actorFields('updatedBy', req.user));
    Object.assign(lead, data);
    await lead.save();
    const changed = Object.keys(data).filter((key) => !key.startsWith('updatedBy') && JSON.stringify(before[key]) !== JSON.stringify(lead[key]));
    await recordAudit({ lead, type: 'lead_updated', title: 'Lead updated', description: changed.length ? `Updated: ${changed.join(', ')}` : 'Lead details updated', user: req.user, metadata: { changedFields: changed } });
    if (changed.includes('status')) await recordAudit({ lead, type: 'status_changed', title: 'Status changed', description: `Status changed from ${before.status || 'Not set'} to ${lead.status || 'Not set'}`, user: req.user, metadata: { oldValue: before.status || '', newValue: lead.status || '' } });
    if (assigneeChanged) await recordAudit({ lead, type: previousAssigneeId ? 'lead_reassigned' : 'lead_assigned', title: previousAssigneeId ? 'Lead reassigned' : 'Lead assigned', description: `Lead assigned to ${lead.assignedToText || lead.assignedToEmail || 'Unassigned'}`, user: req.user, metadata: { changedFields: ['assignedTo'], previousAssignee: { id: previousAssigneeId, name: before.assignedToText || '', email: before.assignedToEmail || '' }, newAssignee: { id: nextAssigneeId, name: lead.assignedToText || '', email: lead.assignedToEmail || '' } } });
    if (closerChanged) await recordAudit({ lead, type: nextCloserId ? 'lead_closed' : 'lead_reopened', title: nextCloserId ? 'Lead closed' : 'Lead reopened', description: nextCloserId ? `Lead closed by ${lead.closedByText || lead.closedByEmail}` : 'Lead reopened', user: req.user, metadata: { changedFields: ['closedBy'], previousCloser: { id: previousCloserId, name: before.closedByText || '', email: before.closedByEmail || '' }, newCloser: { id: nextCloserId, name: lead.closedByText || '', email: lead.closedByEmail || '' } } });
    if (changed.includes('notes')) await recordAudit({ lead, type: 'lead_updated', title: 'Notes updated', description: 'Lead notes updated', user: req.user, metadata: { field: 'notes', oldValue: before.notes || '', newValue: lead.notes || '' } });
    if (changed.some((key) => ['nextFollowUpDate', 'nextFollowUpTime', 'followUpRemarks'].includes(key))) {
      const completed = Boolean(before.nextFollowUpDate) && !lead.nextFollowUpDate;
      await recordAudit({ lead, type: completed ? 'follow_up_completed' : 'follow_up', title: completed ? 'Follow-up completed' : 'Follow-up updated', description: lead.followUpRemarks || (completed ? 'Follow-up completed' : 'Follow-up schedule updated'), user: req.user, metadata: { date: lead.nextFollowUpDate || '', time: lead.nextFollowUpTime || '', oldRemarks: before.followUpRemarks || '', newRemarks: lead.followUpRemarks || '' } });
    }
    await lead.populate('assignedTo createdBy updatedBy closedBy', PUBLIC_USER_FIELDS);
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
  const warnings = [];
  const allowedFields = Object.keys(Lead.schema.paths).filter((field) => !['_id', '__v', 'createdAt', 'updatedAt'].includes(field));

  for (let index = 0; index < rows.length; index += 1) {
    try {
      const { data, unknown } = canonicalizeBulkRow(rows[index], allowedFields);
      if (unknown.length) throw new Error(`Unknown field(s): ${unknown.join(', ')}`);
      normalizeBulkDates(data).forEach((warning) => warnings.push({ row: index + 2, company: String(data.company || ''), ...warning }));
      const lead = await createLeadRecord(data, req.user, { bulk: true });
      await recordAudit({ lead, type: 'lead_created', title: 'Lead imported', description: `Lead ${lead.leadCode} imported`, user: req.user, metadata: { source: 'bulk', row: index + 1 } });
      await lead.populate('assignedTo createdBy updatedBy closedBy importedBy', PUBLIC_USER_FIELDS);
      leads.push(normalizeLeadOutput(lead));
    } catch (err) {
      failures.push({
        row: index + 2,
        company: String(rows[index]?.company || rows[index]?.Company || ''),
        error: err.message || 'Unable to save lead'
      });
    }
  }

  res.status(failures.length && !leads.length ? 400 : 201).json({
    ok: failures.length === 0,
    imported: leads.length,
    failed: failures.length,
    leads,
    failures,
    warnings
  });
};

exports._test = { normalizeLeadOutput, actorFields, assignmentActorFields, createLeadRecord };
