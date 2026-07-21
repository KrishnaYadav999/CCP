const mongoose = require('mongoose');

const LeadAuditSchema = new mongoose.Schema({
  leadId: { type: String, trim: true, index: true },
  sourceLeadId: { type: String, trim: true, index: true },
  leadCode: { type: String, trim: true, index: true },
  company: { type: String, trim: true, index: true },
  eventType: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  actorId: { type: String, trim: true },
  actorName: { type: String, trim: true, default: 'CCP' },
  actorEmail: { type: String, trim: true, lowercase: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

LeadAuditSchema.index({ leadCode: 1, createdAt: -1 });
LeadAuditSchema.index({ company: 1, createdAt: -1 });

module.exports = mongoose.model('LeadAudit', LeadAuditSchema);
