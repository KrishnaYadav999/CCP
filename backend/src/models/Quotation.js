const mongoose = require('mongoose');

const QuotationSchema = new mongoose.Schema({
  selectedLead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
  companyName: { type: String, trim: true, required: true },
  quotationNumber: { type: String, trim: true, required: true },
  quotationDate: { type: String, trim: true },
  validUntil: { type: String, trim: true, required: true },
  items: { type: [mongoose.Schema.Types.Mixed], default: [] },
  terms: { type: [String], default: [] },
  subtotal: { type: Number, default: 0, min: 0 },
  grandTotal: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['draft', 'submitted'], default: 'submitted' },
  source: { type: String, enum: ['manual', 'bulk'], default: 'manual' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

QuotationSchema.index({ selectedLead: 1, quotationNumber: 1 }, { unique: true });

module.exports = mongoose.model('Quotation', QuotationSchema);
