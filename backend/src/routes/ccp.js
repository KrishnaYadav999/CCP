const express = require('express');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Lead = require('../models/Lead');
const Client = require('../models/Client');
const PendingApproval = require('../models/PendingApproval');
const Quotation = require('../models/Quotation');
const { backfillApprovalStatus, normalizeApprovalStatus, normalizeClientOutput } = require('../controllers/clientController');
const { updateClientPendingApproval } = require('../utils/pendingApproval');
const { sanitizeClientPayloadForCrm, syncPendingApprovalToCrm } = require('../utils/crmPendingApprovalSync');
const { requireOptionalAuth } = require('../middleware/auth');
const { buildLeadVisibilityQuery, buildClientVisibilityQuery } = require('../utils/visibilityScope');
const asyncHandler = require('../utils/asyncHandler');
const ccpLeadController = require('../controllers/ccpLeadController');
const clientController = require('../controllers/clientController');
const requireCcpSharedKey = require('../middleware/ccpSharedKey');

const router = express.Router();

function isPublicReadEndpoint(req) {
  return req.method === 'GET' && req.path === '/clients';
}

function isDirectLeadEndpoint(req) {
  return req.path === '/leads' || req.path === '/leads/bulk' || req.path.startsWith('/leads/');
}

router.use((req, res, next) => {
  if (isPublicReadEndpoint(req) || isDirectLeadEndpoint(req)) return next();
  return requireCcpSharedKey(req, res, next);
});

router.use((req, res, next) => {
  if (isPublicReadEndpoint(req) || isDirectLeadEndpoint(req)) return next();
  return requireOptionalAuth(req, res, next);
});

async function runPublicRead(res, key, loadRecords, normalizeRecord) {
  try {
    await connectDB();
    const records = await loadRecords();
    const normalized = Array.isArray(records) ? records.map(normalizeRecord) : [];
    return res.json({
      ok: true,
      source: 'ccp',
      count: normalized.length,
      generatedAt: new Date().toISOString(),
      [key]: normalized
    });
  } catch (err) {
    console.error(`Public CCP ${key} read failed`, err);
    return res.json({ ok: true, source: 'ccp', [key]: [] });
  }
}

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

router.get('/leads', ccpLeadController.requireSecret, requireOptionalAuth, asyncHandler(ccpLeadController.list));
router.post('/leads', ccpLeadController.requireSecret, requireOptionalAuth, asyncHandler(ccpLeadController.create));
router.post('/leads/bulk', ccpLeadController.requireSecret, requireOptionalAuth, asyncHandler(ccpLeadController.bulkCreate));
router.put('/leads/:id', ccpLeadController.requireSecret, requireOptionalAuth, asyncHandler(ccpLeadController.update));

router.get('/clients', (req, res) => runPublicRead(
  res,
  'clients',
  async () => {
    await backfillApprovalStatus();
    return Client.find({})
      .populate('createdBy', 'name email')
      .populate({
        path: 'selectedLead',
        select: 'leadCode company status emails mobileNo1 piboCategory eprCategory addressLine1 addressLine2 addressLine3 state city pinCode contactPerson designation importedCreatedBy createdByEmail createdBy',
        populate: { path: 'createdBy', select: 'name email' }
      })
      .populate('adminControls.assignedTo', 'name email crmUserId role avatarUrl team teamId managerId operationHeadId')
      .sort({ createdAt: -1 })
      .lean();
  },
 normalizeClientForCrm
));

router.get('/clients/reconciliation', asyncHandler(async (req, res) => {
  const clients = await Client.find({}).select('data.importMeta.uniqueId data.importMeta.leadNumber data.importMeta.ccpClientId').lean();
  const identities = clients.map((client) => ({
    clientId: String(client._id),
    uniqueId: String(client.data?.importMeta?.uniqueId || ''),
    leadNumber: String(client.data?.importMeta?.leadNumber || ''),
    ccpClientId: String(client.data?.importMeta?.ccpClientId || '')
  }));
  res.json({ ok: true, source: 'ccp', count: clients.length, identities, generatedAt: new Date().toISOString() });
}));

// CRM-originated Client Master records are written only to CCP. The router-level
// shared-key guard protects these service-to-service endpoints; a CCP user JWT is
// optional so CRM imports can preserve their own creator identity fields.
router.post('/clients', asyncHandler(clientController.createClient));
router.post('/clients/bulk', asyncHandler(clientController.bulkCreateClients));
router.post('/clients/years/bulk', asyncHandler(clientController.bulkUpdateClientYears));
router.put('/clients/:id', asyncHandler(clientController.updateClient));

router.get('/quotations', async (req, res) => {
  try {
    await connectDB();
    const [stored, legacyClients] = await Promise.all([
      Quotation.find({})
        .populate('createdBy', 'name email')
        .populate({
          path: 'selectedLead',
          select: 'leadCode sourceLeadId company contactPerson designation mobileNo1 mobileNo2 emails importedCreatedBy createdByEmail assignedToText createdBy',
          populate: { path: 'createdBy', select: 'name email' }
        })
        .sort({ updatedAt: -1 })
        .lean(),
      Client.find({ $or: [{ 'data.quotation': { $exists: true } }, { 'data.quotations.0': { $exists: true } }] })
        .populate({
          path: 'selectedLead',
          select: 'leadCode sourceLeadId company contactPerson designation mobileNo1 mobileNo2 emails importedCreatedBy createdByEmail assignedToText createdBy',
          populate: { path: 'createdBy', select: 'name email' }
        })
        .select('selectedLead data.quotation data.quotations createdByName createdByEmail createdAt updatedAt')
        .lean()
    ]);

    const records = new Map();
    stored.forEach((quotation) => {
      const leadId = String(quotation.selectedLead?._id || quotation.selectedLead || '');
      records.set(`${leadId}::${String(quotation.quotationNumber || '').toLowerCase()}`, quotation);
    });
    legacyClients.forEach((client) => {
      const lead = client.selectedLead || {};
      const leadId = String(lead._id || lead || '');
      const quotations = Array.isArray(client.data?.quotations) && client.data.quotations.length
        ? client.data.quotations
        : client.data?.quotation ? [client.data.quotation] : [];
      quotations.forEach((quotation, index) => {
        const quotationNumber = String(quotation.quotationNumber || `LEGACY-${client._id}-${index + 1}`);
        const key = `${leadId}::${quotationNumber.toLowerCase()}`;
        if (records.has(key)) return;
        records.set(key, {
          _id: `legacy-${client._id}-${index + 1}`,
          selectedLead: lead,
          companyName: lead.company || client.data?.basic?.clientLegalName || '',
          quotationNumber,
          quotationDate: quotation.quotationDate || '',
          validUntil: quotation.validUntil || '',
          items: quotation.items || [],
          terms: quotation.terms || [],
          subtotal: Number(quotation.subtotal || 0),
          grandTotal: Number(quotation.grandTotal || quotation.subtotal || 0),
          status: 'submitted',
          source: 'bulk',
          createdByName: client.createdByName || lead.importedCreatedBy || lead.createdBy?.name || lead.createdByEmail || '',
          createdAt: client.createdAt,
          updatedAt: client.updatedAt,
          legacy: true
        });
      });
    });

    const quotations = [...records.values()].sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0));
    console.info('[CCP integration]', {
      path: req.originalUrl.split('?')[0],
      status: 200,
      database: process.env.DB_NAME || 'ccp',
      quotations: quotations.length
    });
    return res.json({ ok: true, source: 'ccp', total: quotations.length, quotations });
  } catch (err) {
    console.error('[CCP integration]', {
      path: req.originalUrl.split('?')[0],
      status: 500,
      database: process.env.DB_NAME || 'ccp',
      error: err?.name || 'DatabaseError'
    });
    return res.status(500).json({ ok: false, error: 'Unable to fetch CCP quotations' });
  }
});

router.get('/pending-approvals', asyncHandler(async (req, res) => {
  const status = req.query.status
    ? normalizeApprovalStatus(req.query.status)
    : undefined;
  const query = { type: 'client', source: 'ccp' };
  if (status) query.approvalStatus = status;

  const approvals = await PendingApproval.find(query)
    .sort({ createdAt: -1 })
    .lean();

  res.json({ ok: true, source: 'ccp', approvals: approvals.map(normalizePendingApprovalForCrm) });
}));

router.patch('/clients/:id/approval', asyncHandler(async (req, res) => {
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
}));

module.exports = router;
