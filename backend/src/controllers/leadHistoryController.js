const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Client = require('../models/Client');
const PendingApproval = require('../models/PendingApproval');
const Notification = require('../models/Notification');
const LeadAudit = require('../models/LeadAudit');
const { buildHistory } = require('../services/leadHistoryService');

function value(input) { return String(input || '').trim(); }
function exact(input) { return new RegExp(`^${value(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'); }
function actor(user) {
  return { actorId: value(user?._id || user?.id || user?.crmUserId), actorName: value(user?.name || user?.email) || 'CRM e-Connect', actorEmail: value(user?.email).toLowerCase() };
}

async function findLead(id, leadCode, company) {
  const clauses = [];
  if (mongoose.Types.ObjectId.isValid(id)) clauses.push({ _id: id });
  if (id) clauses.push({ sourceLeadId: id }, { leadCode: exact(id) });
  if (leadCode) clauses.push({ leadCode: exact(leadCode) }, { sourceLeadId: leadCode });
  if (company) clauses.push({ company: exact(company) });
  return clauses.length ? Lead.findOne({ $or: clauses }).populate('createdBy', 'name email').lean() : null;
}

function identifiers(id, leadCode, company, lead) {
  return {
    ids: [...new Set([id, lead?._id, lead?.sourceLeadId].map(value).filter(Boolean))],
    codes: [...new Set([leadCode, lead?.leadCode].map(value).filter(Boolean))],
    companies: [...new Set([company, lead?.company].map(value).filter(Boolean))]
  };
}

function exactClauses(paths, values) {
  return values.flatMap((item) => paths.map((path) => ({ [path]: exact(item) })));
}

async function loadRelated(keys) {
  const auditClauses = [
    ...keys.ids.flatMap((id) => [{ leadId: id }, { sourceLeadId: id }]),
    ...keys.codes.map((leadCode) => ({ leadCode: exact(leadCode) })),
    ...keys.companies.map((company) => ({ company: exact(company) }))
  ];
  const clientClauses = [
    ...keys.ids.map((id) => mongoose.Types.ObjectId.isValid(id) ? { selectedLead: id } : null).filter(Boolean),
    ...exactClauses(['data.importMeta.uniqueId', 'data.importMeta.sourceLeadId', 'data.importMeta.leadNumber', 'data.leadCode'], [...keys.ids, ...keys.codes]),
    ...exactClauses(['data.basic.clientLegalName', 'data.basic.tradeName', 'data.company'], keys.companies)
  ];
  const notificationClauses = [
    ...exactClauses(['metadata.leadId', 'metadata.sourceLeadId', 'metadata.leadCode'], [...keys.ids, ...keys.codes]),
    ...exactClauses(['metadata.company', 'metadata.clientName'], keys.companies)
  ];
  const approvalClauses = [
    ...exactClauses(['sourceClientId', 'uniqueId', 'payload.leadId', 'payload.leadCode', 'payload.uniqueId'], [...keys.ids, ...keys.codes]),
    ...exactClauses(['clientName', 'payload.company', 'payload.clientName'], keys.companies)
  ];

  const [audits, clients, notifications, approvals] = await Promise.all([
    auditClauses.length ? LeadAudit.find({ $or: auditClauses }).sort({ createdAt: -1 }).lean() : [],
    clientClauses.length ? Client.find({ $or: clientClauses }).lean() : [],
    notificationClauses.length ? Notification.find({ $or: notificationClauses }).lean() : [],
    approvalClauses.length ? PendingApproval.find({ $or: approvalClauses }).lean() : []
  ]);
  return { audits, clients, notifications, approvals };
}

exports.getHistory = async (req, res) => {
  const id = value(req.params.id);
  const requestedCode = value(req.query.leadCode);
  const requestedCompany = value(req.query.company);
  if (!id && !requestedCode && !requestedCompany) return res.status(400).json({ ok: false, error: 'At least one lead identifier is required', code: 'LEAD_IDENTIFIER_REQUIRED' });

  const lead = await findLead(id, requestedCode, requestedCompany);
  const keys = identifiers(id, requestedCode, requestedCompany, lead);
  const related = await loadRelated(keys);
  const history = buildHistory({ lead, ...related });
  return res.json({
    ok: true,
    lead: { id: value(lead?._id || lead?.sourceLeadId || id), leadCode: value(lead?.leadCode || requestedCode), company: value(lead?.company || requestedCompany) },
    ...history
  });
};

exports.logEmail = async (req, res) => {
  const id = value(req.params.id);
  const leadCode = value(req.body.leadCode);
  const company = value(req.body.company);
  const recipient = value(req.body.recipient).toLowerCase();
  if (!recipient) return res.status(400).json({ ok: false, error: 'Recipient is required', code: 'RECIPIENT_REQUIRED' });
  if (!id && !leadCode && !company) return res.status(400).json({ ok: false, error: 'At least one lead identifier is required', code: 'LEAD_IDENTIFIER_REQUIRED' });

  const lead = await findLead(id, leadCode, company);
  const audit = await LeadAudit.create({
    leadId: value(lead?._id || id), sourceLeadId: value(lead?.sourceLeadId),
    leadCode: value(lead?.leadCode || leadCode), company: value(lead?.company || company),
    eventType: 'email_sent', title: 'Introduction email sent',
    description: `Introduction email sent to ${recipient}`, ...actor(req.user), metadata: { recipient }
  });
  return res.status(201).json({ ok: true, event: { id: value(audit._id), type: 'email_sent', title: audit.title, description: audit.description, actor: audit.actorName, at: audit.createdAt.toISOString(), metadata: audit.metadata } });
};

exports.recordAudit = async ({ lead, type, title, description, user, metadata = {} }) => LeadAudit.create({
  leadId: value(lead?._id), sourceLeadId: value(lead?.sourceLeadId), leadCode: value(lead?.leadCode),
  company: value(lead?.company), eventType: type, title, description, ...actor(user), metadata
});
