const crypto = require('crypto');

const SUPPORTED_TYPES = new Set([
  'lead_created', 'lead_updated', 'status_changed', 'assignment_changed', 'email_sent',
  'quotation_created', 'quotation_updated', 'approval_pending', 'quotation_approved',
  'quotation_rejected', 'follow_up', 'follow_up_completed', 'todo', 'todo_completed'
]);

function text(value) { return String(value ?? '').trim(); }
function date(value, fallback) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : fallback;
}
function idFor(prefix, source, at) {
  return `${prefix}-${crypto.createHash('sha1').update(`${source}|${at.toISOString()}`).digest('hex').slice(0, 16)}`;
}
function event(input) {
  const at = date(input.at, new Date(0));
  return {
    id: text(input.id) || idFor(input.type, input.source || input.description || input.title, at),
    type: SUPPORTED_TYPES.has(input.type) ? input.type : 'lead_updated',
    title: text(input.title) || 'Lead updated',
    description: text(input.description),
    actor: text(input.actor) || 'CCP',
    at: at.toISOString(),
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {}
  };
}

function auditEvents(audits = []) {
  return audits.map((row) => event({
    id: row._id, type: row.eventType, title: row.title, description: row.description,
    actor: row.actorName, at: row.createdAt, metadata: row.metadata, source: row._id
  }));
}

function leadBackfill(lead) {
  if (!lead) return [];
  const out = [];
  const createdAt = date(lead.importedCreatedAt || lead.leadDate, date(lead.createdAt, new Date(0)));
  out.push(event({ type: 'lead_created', title: 'Lead created', description: `Lead ${text(lead.leadCode) || text(lead.sourceLeadId) || 'record'} created`, actor: lead.importedCreatedBy || lead.createdBy?.name, at: createdAt, source: `lead:${lead._id}:created` }));
  const updatedAt = date(lead.importedUpdatedAt, date(lead.updatedAt));
  if (updatedAt && updatedAt > createdAt) out.push(event({ type: 'lead_updated', title: 'Lead updated', description: 'Lead details updated', actor: lead.importedCreatedBy || lead.createdBy?.name, at: updatedAt, source: `lead:${lead._id}:updated` }));
  if (text(lead.status)) out.push(event({ type: 'status_changed', title: 'Status changed', description: `Current status: ${text(lead.status)}`, at: updatedAt || createdAt, metadata: { newValue: lead.status }, source: `lead:${lead._id}:status` }));
  const assignee = text(lead.assignedToText || lead.assignedTo?.name);
  if (assignee) out.push(event({ type: 'assignment_changed', title: 'Lead assigned', description: `Lead assigned to ${assignee}`, actor: lead.assignedBy, at: updatedAt || createdAt, metadata: { newValue: assignee }, source: `lead:${lead._id}:assignment` }));
  if (text(lead.nextFollowUpDate) || text(lead.followUpRemarks)) out.push(event({ type: 'follow_up', title: 'Follow-up scheduled', description: text(lead.followUpRemarks) || 'Follow-up scheduled', at: date(lead.nextFollowUpDate, updatedAt || createdAt), metadata: { date: lead.nextFollowUpDate, time: lead.nextFollowUpTime }, source: `lead:${lead._id}:followup` }));
  return out;
}

function clientEvents(clients = []) {
  return clients.flatMap((client) => {
    const data = client.data || {};
    const number = text(data.validation?.quotationNumber || data.quotationNumber);
    const label = number ? `Quotation ${number}` : 'Quotation';
    const created = event({ type: 'quotation_created', title: 'Quotation created', description: `${label} created`, actor: client.createdByName, at: client.createdAt, metadata: { quotationNumber: number, clientId: text(client._id) }, source: `client:${client._id}:created` });
    const out = [created];
    if (date(client.updatedAt) > date(client.createdAt)) out.push(event({ type: 'quotation_updated', title: 'Quotation updated', description: `${label} updated`, actor: client.createdByName, at: client.updatedAt, metadata: { quotationNumber: number, clientId: text(client._id) }, source: `client:${client._id}:updated` }));
    const status = text(client.approvalMeta?.status || client.adminControls?.approvalStatus).toUpperCase();
    if (status) {
      const type = status === 'APPROVED' ? 'quotation_approved' : status === 'REJECTED' ? 'quotation_rejected' : 'approval_pending';
      out.push(event({ type, title: status === 'PENDING' ? 'Quotation approval requested' : `Quotation ${status.toLowerCase()}`, description: client.approvalMeta?.remarks || `${label} is ${status.toLowerCase()}`, actor: client.approvalMeta?.actionBy || client.createdByName, at: client.approvalMeta?.actionAt || client.updatedAt || client.createdAt, metadata: { status, quotationNumber: number, clientId: text(client._id) }, source: `client:${client._id}:approval:${status}` }));
    }
    return out;
  });
}

function approvalEvents(rows = []) {
  return rows.filter((row) => row.type === 'quotation').flatMap((row) => {
    const out = [event({ type: 'approval_pending', title: 'Quotation approval requested', description: 'Quotation sent for approval', actor: row.createdByName, at: row.createdAt || row.requestDate, metadata: { approvalId: text(row._id) }, source: `approval:${row._id}:pending` })];
    const status = text(row.approvalStatus).toUpperCase();
    if (['APPROVED', 'REJECTED'].includes(status)) out.push(event({ type: status === 'APPROVED' ? 'quotation_approved' : 'quotation_rejected', title: `Quotation ${status.toLowerCase()}`, description: row.remarks || `Quotation ${status.toLowerCase()}`, actor: row.actionBy, at: row.actionAt || row.updatedAt, metadata: { status, remarks: row.remarks, approvalId: text(row._id) }, source: `approval:${row._id}:${status}` }));
    return out;
  });
}

function notificationEvents(rows = []) {
  return rows.filter((row) => ['todo', 'follow-up'].includes(row.kind)).map((row) => {
    const completed = row.status === 'Inactive' || Boolean(row.metadata?.completedAt || row.metadata?.completed);
    const isTodo = row.kind === 'todo';
    return event({ type: isTodo ? (completed ? 'todo_completed' : 'todo') : (completed ? 'follow_up_completed' : 'follow_up'), title: row.title, description: row.description, actor: row.createdByName, at: row.metadata?.completedAt || row.updatedAt || row.createdAt, metadata: { ...(row.metadata || {}), notificationId: text(row._id) }, source: `notification:${row._id}:${completed}` });
  });
}

function buildHistory({ lead, audits, clients, approvals, notifications }) {
  const canonical = auditEvents(audits);
  const auditedTypes = new Set(canonical.map((item) => item.type));
  const seen = new Set();
  const leadLegacy = leadBackfill(lead).filter((item) => !auditedTypes.has(item.type));
  const events = [...canonical, ...leadLegacy, ...clientEvents(clients), ...approvalEvents(approvals), ...notificationEvents(notifications)]
    .filter((item) => { const key = item.id; if (seen.has(key)) return false; seen.add(key); return true; })
    .sort((a, b) => new Date(b.at) - new Date(a.at));
  return {
    events,
    summary: {
      total: events.length,
      quotations: events.filter((e) => e.type.startsWith('quotation_') || e.type === 'approval_pending').length,
      followUps: events.filter((e) => e.type.startsWith('follow_up')).length,
      todos: events.filter((e) => e.type.startsWith('todo')).length,
      emails: events.filter((e) => e.type === 'email_sent').length
    }
  };
}

module.exports = { SUPPORTED_TYPES, buildHistory, event };
