const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema({
  communicationMode: { type: String, trim: true },
  status: { type: String, trim: true, required: true },
  company: { type: String, trim: true, required: true },
  industryType: { type: String, trim: true },
  eprCategory: { type: String, trim: true },
  piboCategory: { type: String, trim: true, required: true },
  servicesOffered: { type: String, trim: true, required: true },
  addressLine1: { type: String, trim: true, required: true },
  addressLine2: { type: String, trim: true },
  addressLine3: { type: String, trim: true },
  landmark: { type: String, trim: true },
  state: { type: String, trim: true, required: true },
  city: { type: String, trim: true, required: true },
  pinCode: { type: String, trim: true, required: true },
  existingClient: { type: String, enum: ['Yes', 'No'], default: 'No' },
  website: { type: String, trim: true },
  salutation: { type: String, trim: true },
  contactPerson: { type: String, trim: true },
  designation: { type: String, trim: true },
  emails: { type: String, trim: true },
  mobileNo1: { type: String, trim: true },
  mobileNo2: { type: String, trim: true },
  businessCardUrl: { type: String },
  referredBy: { type: String, trim: true },
  source: { type: String, trim: true },
  notes: { type: String, trim: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  workflowStatus: { type: String, enum: ['draft', 'submitted'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Lead', LeadSchema);
