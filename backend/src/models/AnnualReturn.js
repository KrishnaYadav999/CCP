const mongoose = require('mongoose');

const mixed = mongoose.Schema.Types.Mixed;
const AnnualReturnSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, unique: true, index: true },
  filings: { type: mixed, default: {} },
  draft: { type: mixed, default: {} },
  basicInfo: { type: mixed, default: {} },
  financials: { type: mixed, default: {} },
  data: { type: mixed, default: {} },
  brandOwner: { type: mixed, default: {} },
  importer: { type: mixed, default: {} },
  annual: { type: mixed, default: {} },
  approvalWorkflow: { type: mixed, default: {} },
  clientData: { type: mixed, default: {} },
  adminControls: { type: mixed, default: {} },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true, minimize: false });

module.exports = mongoose.model('AnnualReturn', AnnualReturnSchema);
