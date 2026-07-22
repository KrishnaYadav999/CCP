const mongoose = require('mongoose');

const ClientSyncRunSchema = new mongoose.Schema({
  syncRunId: { type: String, required: true, unique: true, index: true, trim: true },
  expectedTotal: { type: Number, required: true, min: 1 },
  receivedTotal: { type: Number, default: 0 },
  createdCount: { type: Number, default: 0 },
  updatedCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  processedIds: { type: [String], default: [] },
  processedKeys: { type: [String], default: [], select: false },
  receivedKeys: { type: [String], default: [], select: false },
  failedRecords: { type: [mongoose.Schema.Types.Mixed], default: [] },
  missingIds: { type: [String], default: [] },
  unexpectedIds: { type: [String], default: [] },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  durationMs: { type: Number, default: 0 },
  status: { type: String, enum: ['RUNNING', 'PARTIAL', 'RECONCILED', 'FAILED'], default: 'RUNNING', index: true }
}, { timestamps: true, minimize: false });

module.exports = mongoose.model('ClientSyncRun', ClientSyncRunSchema);
