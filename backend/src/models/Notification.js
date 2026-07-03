const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  tag: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  kind: { type: String, enum: ['announcement', 'todo', 'follow-up', 'workflow'], default: 'announcement' },
  createdByName: { type: String, trim: true, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  audience: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  visibleToRoles: [{ type: String, trim: true }],
  attachmentName: { type: String, trim: true, default: '' },
  attachmentUrl: { type: String, trim: true, default: '' },
  pinned: { type: Boolean, default: false },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  crmNotificationId: { type: String, unique: true, sparse: true, trim: true },
  ccpNotificationId: { type: String, unique: true, sparse: true, trim: true },
  source: { type: String, enum: ['crm', 'ccp'], default: 'ccp' }
}, { timestamps: true });

NotificationSchema.index({ status: 1, kind: 1, createdAt: -1 });
NotificationSchema.index({ audience: 1 });
NotificationSchema.index({ visibleToRoles: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);
