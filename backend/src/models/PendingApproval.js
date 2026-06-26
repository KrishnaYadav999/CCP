const mongoose = require('mongoose');

const PendingApprovalSchema = new mongoose.Schema({
  type: { type: String, enum: ['client', 'quotation'], required: true },
  source: { type: String, default: 'ccp', trim: true },
  sourceClientId: { type: String, trim: true },
  uniqueId: { type: String, trim: true },
  clientName: { type: String, trim: true },
  approvalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  piboCategory: { type: String, trim: true },
  eprCategory: { type: String, trim: true },
  createdByName: { type: String, trim: true },
  requestDate: { type: String, trim: true },
  requestTime: { type: String, trim: true },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  actionBy: { type: String, trim: true },
  actionAt: { type: Date },
  remarks: { type: String, trim: true },
  crmSyncStatus: { type: String, enum: ['PENDING', 'SYNCED', 'FAILED'], default: 'PENDING' },
  crmSyncAt: { type: Date },
  crmSyncError: { type: String, trim: true },
  crmApprovalId: { type: String, trim: true },
  nextReminderAt: { type: Date, default: Date.now },
  lastReminderAt: { type: Date },
  reminderCount: { type: Number, default: 0 },
  reminderError: { type: String, trim: true },
  notifiedAdminEmails: [{ type: String, lowercase: true, trim: true }]
}, { timestamps: true });

PendingApprovalSchema.index({ type: 1, source: 1, sourceClientId: 1 }, { unique: true, sparse: true });
PendingApprovalSchema.index({ type: 1, source: 1, uniqueId: 1 });
PendingApprovalSchema.index({ approvalStatus: 1, createdAt: -1 });
PendingApprovalSchema.index({ approvalStatus: 1, nextReminderAt: 1 });

module.exports = mongoose.model('PendingApproval', PendingApprovalSchema);
