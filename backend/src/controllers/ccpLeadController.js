const crypto = require('crypto');
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { PUBLIC_USER_FIELDS, resolveLeadUser, resolveImportedUser, userFields, publicUser } = require('../utils/leadUserIdentity');
const { canonicalizeBulkRow, normalizeBulkDates } = require('../utils/bulkLeadImport');

const FIELDS = [
  'sourceLeadId', 'communicationMode', 'status', 'company', 'industryType',
  'eprCategory', 'piboParent', 'piboCategory', 'servicesOffered',
  'addressLine1', 'addressLine2', 'addressLine3', 'landmark', 'state', 'city',
  'pinCode', 'gstNumber', 'existingClient', 'website', 'salutation', 'contactPerson',
  'designation', 'emails', 'emailsSentCount', 'lastEmailSent', 'mobileNo1', 'mobileNo2', 'businessCardUrl',
  'referredBy', 'source', 'notes', 'assignedToText', 'assignedToEmail',
  'assignedTo', 'assignedToCrmUserId', 'assignedBy', 'assignedByName',
  'assignedByEmail', 'assignedByUserId', 'assignedAt', 'importedCreatedBy',
  'createdBy', 'createdByName', 'createdByCrmUserId', 'createdByEmail', 'updatedBy', 'updatedByEmail',
  'updatedByText', 'updatedByCrmUserId', 'closedBy', 'closedByText', 'closedByEmail',
  'closedByCrmUserId', 'closedAt', 'leadDate', 'nextFollowUpDate',
  'nextFollowUpTime', 'followUpRemarks', 'importedCreatedAt',
  'importedUpdatedAt', 'importedBy', 'importedByName', 'importedByEmail',
  'importedAt', 'complianceHealthReport', 'workflowStatus'
];

const PIBO_CATEGORIES = {
  PIBO: ['Producer', 'Brand Owner', 'Importer'],
  SIMP: ['Producer (Small & Micro)', 'Importer of Raw Material', 'Manufacturer of Raw Material', 'Seller'],
  PWP: ['PWP', 'Recycler', 'Refurbisher', 'Waste to Energy', 'Waste to Oil', 'Cement Co-processing']
};

const LEGACY_PIBO_CATEGORIES = {
  PRODUCER: ['PIBO', 'Producer'],
  'BRAND OWNER': ['PIBO', 'Brand Owner'],
  IMPORTER: ['PIBO', 'Importer'],
  PWP: ['PWP', 'PWP'],
  RECYCLER: ['PWP', 'Recycler'],
  REFURBISHER: ['PWP', 'Refurbisher'],
  'SIMP PRODUCER': ['SIMP', 'Producer (Small & Micro)'],
  'SIMP IMPORTER RAW': ['SIMP', 'Importer of Raw Material'],
  'SIMP MANUFACTURER RAW': ['SIMP', 'Manufacturer of Raw Material'],
  'SIMP SELLER': ['SIMP', 'Seller']
};

function categoryKey(value) {
  return String(value || '').trim().replace(/[\s_-]+/g, ' ').toUpperCase();
}

function normalizePiboHierarchy(data) {
  const legacy = LEGACY_PIBO_CATEGORIES[categoryKey(data.piboCategory)];
  if (legacy) {
    [data.piboParent, data.piboCategory] = legacy;
    return data;
  }

  const requestedCategory = categoryKey(data.piboCategory);
  for (const [parent, categories] of Object.entries(PIBO_CATEGORIES)) {
    const canonical = categories.find((category) => categoryKey(category) === requestedCategory);
    if (canonical && (!data.piboParent || data.piboParent === parent)) {
      data.piboParent = parent;
      data.piboCategory = canonical;
      break;
    }
  }
  return data;
}

function normalizePayload(input = {}, { excel = false, preserveWorkflow = false } = {}) {
  const data = {};
  for (const field of FIELDS) {
    if (input[field] === undefined || input[field] === null) continue;
    data[field] = typeof input[field] === 'string' ? input[field].trim() : input[field];
  }
  if (data.piboCategory === undefined) {
    const legacyCategory = input['PIBO Category'] ?? input.pibo_category;
    if (legacyCategory !== undefined && legacyCategory !== null) {
      data.piboCategory = typeof legacyCategory === 'string' ? legacyCategory.trim() : legacyCategory;
    }
  }
  for (const field of ['emails', 'assignedToEmail', 'assignedByEmail', 'createdByEmail', 'updatedByEmail', 'closedByEmail', 'importedByEmail']) {
    if (typeof data[field] === 'string') data[field] = data[field].toLowerCase();
  }
  if (typeof data.piboParent === 'string') data.piboParent = data.piboParent.toUpperCase();
  normalizePiboHierarchy(data);
  if (excel) data.workflowStatus = 'draft';
  else if (!preserveWorkflow || data.workflowStatus !== undefined) {
    data.workflowStatus = data.workflowStatus === 'submitted' ? 'submitted' : 'draft';
  }
  return data;
}

function isValidObjectId(value) {
  return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value) && mongoose.Types.ObjectId.isValid(value);
}

function preserveReferenceText(data, field, value) {
  const raw = String(value || '').trim();
  if (!raw) return;
  const textKey = field === 'assignedTo' ? 'assignedToText' : field === 'createdBy' ? 'createdByName' : `${field}Text`;
  const emailKey = `${field}Email`;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    if (!data[emailKey]) data[emailKey] = raw.toLowerCase();
  } else if (!data[textKey]) data[textKey] = raw;
}

function sanitizeObjectIdReferences(data) {
  for (const field of ['assignedTo', 'closedBy', 'updatedBy', 'createdBy']) {
    const value = data[field];
    if (value === undefined) continue;
    if (isValidObjectId(String(value).trim())) {
      data[field] = String(value).trim();
      continue;
    }
    if (typeof value === 'string') preserveReferenceText(data, field, value);
    delete data[field];
  }
  return data;
}

function validatePayload(data) {
  if (!data.company) return 'Company is required';
  if (data.piboParent && !PIBO_CATEGORIES[data.piboParent]) {
    return 'PIBO parent must be PIBO, SIMP or PWP';
  }
  if (data.piboCategory && !data.piboParent) return 'PIBO parent is required when PIBO category is provided';
  if (data.piboCategory && !PIBO_CATEGORIES[data.piboParent].includes(data.piboCategory)) {
    return `PIBO category is invalid for ${data.piboParent}`;
  }
  return '';
}

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function integrationKey(data) {
  if (data.sourceLeadId) return `source:${String(data.sourceLeadId).toLowerCase()}`;
  const identity = [data.company, data.emails, data.mobileNo1, data.leadDate, data.importedCreatedAt]
    .map((value) => String(value || '').trim().toLowerCase()).join('|');
  return `row:${digest(identity)}`;
}

async function getNextLeadCode(models) {
  const candidates = await Promise.all([
    models.Lead.findOne({ leadCode: /^ATPL-\d{4}$/ }).sort({ leadCode: -1 }).select('leadCode').lean(),
    models.Lead.findOne({ leadCode: /^ATPL-LEAD-\d{4}$/ }).sort({ leadCode: -1 }).select('leadCode').lean(),
    models.Lead.findOne({ sourceLeadId: /^ATPL-\d{4}$/ }).sort({ sourceLeadId: -1 }).select('sourceLeadId').lean(),
    models.Lead.findOne({ sourceLeadId: /^ATPL-LEAD-\d{4}$/ }).sort({ sourceLeadId: -1 }).select('sourceLeadId').lean()
  ]);
  const numberFrom = (lead) => Number.parseInt(String(lead?.leadCode || lead?.sourceLeadId || '').match(/(\d{4})$/)?.[1], 10) || 0;
  const latestNumber = Math.max(0, ...candidates.map(numberFrom));
  return `ATPL-${String(latestNumber + 1).padStart(4, '0')}`;
}

async function mapCrmUser(data, input, prefix, models = { User }, { required = false } = {}) {
  const hasInput = [prefix, `${prefix}Text`, `${prefix}Email`, `${prefix}CrmUserId`].some((key) => input[key] !== undefined && input[key] !== null && input[key] !== '');
  if (!hasInput) return null;
  const { user } = await resolveLeadUser(input, prefix, models.User, { activeOnly: true });
  if (!user) {
    if (!isValidObjectId(String(data[prefix] || '').trim())) delete data[prefix];
    if (required) {
      const error = new Error(`${prefix === 'closedBy' ? 'Lead Closed By' : prefix} must resolve to an active CCP user`);
      error.statusCode = 400;
      throw error;
    }
    return null;
  }
  if (prefix === 'updatedBy') {
    data.updatedBy = user._id;
    data.updatedByText = user.name || user.email || '';
    data.updatedByName = user.name || user.email || '';
    data.updatedByEmail = user.email || '';
    data.updatedByCrmUserId = user.crmUserId || '';
  } else Object.assign(data, userFields(prefix, user));
  return user;
}

async function applyImportedAudit(data, input, models, importer) {
  const assignedDisplay = String(input.assignedByName || input.assignedBy || '').trim();
  if (assignedDisplay || input.assignedByEmail || input.assignedByUserId) {
    const assignedUser = await resolveImportedUser({ name: assignedDisplay, email: input.assignedByEmail, id: input.assignedByUserId, crmUserId: input.assignedByCrmUserId }, models.User);
    data.assignedBy = assignedDisplay || assignedUser?.name || assignedUser?.email || '';
    data.assignedByName = assignedUser?.name || assignedDisplay;
    data.assignedByEmail = assignedUser?.email || String(input.assignedByEmail || '').toLowerCase().trim();
    if (assignedUser?._id) data.assignedByUserId = assignedUser._id;
  }
  const creatorDisplay = String(input.createdByName || input.importedCreatedBy || '').trim();
  if (creatorDisplay || input.createdByEmail || input.createdByCrmUserId || input.createdBy) {
    const creator = await resolveImportedUser({ name: creatorDisplay, email: input.createdByEmail, crmUserId: input.createdByCrmUserId, id: input.createdBy }, models.User);
    data.importedCreatedBy = creatorDisplay || creator?.name || creator?.email || '';
    data.createdByName = creator?.name || creatorDisplay;
    data.createdByEmail = creator?.email || String(input.createdByEmail || '').toLowerCase().trim();
    data.createdByCrmUserId = creator?.crmUserId || String(input.createdByCrmUserId || '').trim();
    if (creator?._id) data.createdBy = creator._id;
  }
  if (importer) {
    data.importedBy = importer._id;
    data.importedByName = importer.name || importer.email || '';
    data.importedByEmail = importer.email || '';
    data.importedAt = new Date();
  } else if (!data.importedAt) data.importedAt = new Date();
  if (data.importedCreatedAt && !Number.isNaN(new Date(data.importedCreatedAt).getTime())) data.createdAt = new Date(data.importedCreatedAt);
}

async function saveLead(input, options = {}, models = { Lead, User }) {
  const data = normalizePayload(input, options);
  sanitizeObjectIdReferences(data);
  const error = validatePayload(data);
  if (error) {
    const validationError = new Error(error);
    validationError.statusCode = 400;
    throw validationError;
  }
  await mapCrmUser(data, input, 'assignedTo', models);
  await mapCrmUser(data, input, 'closedBy', models);
  await mapCrmUser(data, input, 'updatedBy', models);
  sanitizeObjectIdReferences(data);
  if (data.assignedTo && (!options.excel || !data.assignedAt)) data.assignedAt = new Date();
  if (data.closedBy && !data.closedAt) data.closedAt = new Date();
  if (options.excel) await applyImportedAudit(data, input, models, options.importer);
  else {
    const creatorInput = { createdBy: input.createdBy, createdByText: input.importedCreatedBy, createdByEmail: input.createdByEmail, createdByCrmUserId: input.createdByCrmUserId };
    const creator = await mapCrmUser(data, creatorInput, 'createdBy', models);
    if (creator) data.createdByName = creator.name || creator.email || '';
    else data.createdByName = data.importedCreatedBy || '';
  }
  sanitizeObjectIdReferences(data);
  const key = integrationKey(data);
  const existingFilter = data.sourceLeadId ? { sourceLeadId: data.sourceLeadId } : { integrationKey: key };
  const existing = await models.Lead.findOne(existingFilter);
  if (existing) return existing;
  const leadCode = await getNextLeadCode(models);
  const update = { $setOnInsert: { ...data, integrationKey: key, leadCode } };
  try {
    const filter = data.sourceLeadId ? { sourceLeadId: data.sourceLeadId } : { integrationKey: key };
    return await models.Lead.findOneAndUpdate(filter, update, {
      new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true
    });
  } catch (err) {
    if (err?.code !== 11000) throw err;
    return models.Lead.findOne({ $or: [{ integrationKey: key }, { leadCode }] });
  }
}

function leadLookup(id) {
  const value = String(id || '').trim();
  const clauses = [{ sourceLeadId: value }, { leadCode: value }];
  if (mongoose.Types.ObjectId.isValid(value)) clauses.unshift({ _id: value });
  return { $or: clauses };
}

function output(doc) {
  const plain = typeof doc?.toObject === 'function' ? doc.toObject() : { ...(doc || {}) };
  delete plain.integrationKey;
  plain.assignedTo = publicUser(plain.assignedTo, { name: plain.assignedToText, email: plain.assignedToEmail, crmUserId: plain.assignedToCrmUserId }) || plain.assignedTo;
  plain.createdBy = publicUser(plain.createdBy, { name: plain.createdByName || plain.importedCreatedBy, email: plain.createdByEmail, crmUserId: plain.createdByCrmUserId }) || plain.createdBy;
  plain.updatedBy = publicUser(plain.updatedBy, { name: plain.updatedByName, email: plain.updatedByEmail, crmUserId: plain.updatedByCrmUserId }) || plain.updatedBy;
  plain.closedBy = publicUser(plain.closedBy, { name: plain.closedByText, email: plain.closedByEmail, crmUserId: plain.closedByCrmUserId }) || plain.closedBy;
  plain.importedBy = publicUser(plain.importedBy, { name: plain.importedByName, email: plain.importedByEmail }) || plain.importedBy;
  return plain;
}

async function populateLeadUsers(doc) {
  if (typeof doc?.populate === 'function') await doc.populate('assignedTo createdBy updatedBy closedBy importedBy', PUBLIC_USER_FIELDS);
  return doc;
}

exports.requireSecret = (req, res, next) => {
  const expected = process.env.CCP_SHARED_SECRET;
  if (!expected) return res.status(503).json({ ok: false, error: 'CCP integration credential is not configured' });
  if (req.get('x-ccp-secret') !== expected) {
    return res.status(401).json({ ok: false, error: 'Invalid CCP integration credential' });
  }
  return next();
};

exports.create = async (req, res) => {
  try {
    const lead = await populateLeadUsers(await saveLead(req.body));
    return res.status(201).json({ ok: true, lead: output(lead) });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ ok: false, error: err.message || 'Unable to save lead' });
  }
};

exports.bulkCreate = async (req, res) => {
  const rows = Array.isArray(req.body?.leads) ? req.body.leads : [];
  if (!rows.length) return res.status(400).json({ ok: false, error: 'No leads provided' });
  const leads = [];
  const failures = [];
  const warnings = [];
  for (let index = 0; index < rows.length; index += 1) {
    try {
      const { data, unknown } = canonicalizeBulkRow(rows[index], FIELDS);
      if (unknown.length) throw new Error(`Unknown field(s): ${unknown.join(', ')}`);
      normalizeBulkDates(data).forEach((warning) => warnings.push({ row: index + 2, company: String(data.company || ''), ...warning }));
      leads.push(output(await populateLeadUsers(await saveLead(data, { excel: true, importer: req.user }))));
    } catch (err) {
      failures.push({ row: index + 2, company: String(rows[index]?.company || rows[index]?.Company || ''), error: err.message || 'Unable to save lead' });
    }
  }
  return res.status(leads.length ? 201 : 400).json({
    ok: failures.length === 0, imported: leads.length, failed: failures.length, leads, failures, warnings
  });
};

exports.update = async (req, res) => {
  try {
    const existing = await Lead.findOne(leadLookup(req.params.id));
    if (!existing) return res.status(404).json({ ok: false, error: 'Lead not found' });
    const data = normalizePayload(req.body, { preserveWorkflow: true });
    sanitizeObjectIdReferences(data);
    for (const field of ['createdBy', 'createdByName', 'createdByEmail', 'createdByCrmUserId', 'importedCreatedBy', 'importedCreatedAt']) delete data[field];
    const merged = { ...output(existing), ...data };
    const error = validatePayload(merged);
    if (error) return res.status(400).json({ ok: false, error });
    const oldAssignee = String(existing.assignedTo || '');
    if (req.body.assignedTo === '' || req.body.assignedTo === null) Object.assign(data, { assignedTo: null, assignedToText: '', assignedToEmail: '', assignedToCrmUserId: '' });
    else await mapCrmUser(data, req.body, 'assignedTo');
    if (req.body.closedBy === '' || req.body.closedBy === null) Object.assign(data, { closedBy: null, closedByText: '', closedByEmail: '', closedByCrmUserId: '', closedAt: null });
    else await mapCrmUser(data, req.body, 'closedBy', { User });
    await mapCrmUser(data, req.body, 'updatedBy');
    sanitizeObjectIdReferences(data);
    if (Object.prototype.hasOwnProperty.call(data, 'assignedTo') && oldAssignee !== String(data.assignedTo || '')) data.assignedAt = new Date();
    if (data.closedBy && !existing.closedAt) data.closedAt = new Date();
    Object.assign(existing, data);
    await existing.save();
    await populateLeadUsers(existing);
    return res.json({ ok: true, lead: output(existing) });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ ok: false, error: err.message || 'Unable to update lead' });
  }
};

exports.list = async (req, res) => {
  const leads = await Lead.find({})
    .populate('assignedTo createdBy updatedBy closedBy importedBy', PUBLIC_USER_FIELDS)
    .sort({ createdAt: -1 }).lean();
  return res.json({ ok: true, leads: leads.map(output), source: 'ccp-direct' });
};

exports._test = { FIELDS, normalizePayload, normalizePiboHierarchy, validatePayload, integrationKey, getNextLeadCode, mapCrmUser, applyImportedAudit, sanitizeObjectIdReferences, saveLead, leadLookup, output };
