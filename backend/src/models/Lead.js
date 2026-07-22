const mongoose = require('mongoose');

const ScreenshotReferenceSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  type: { type: String, trim: true },
  size: { type: Number, default: 0 },
  dataUrl: { type: String },
  url: { type: String },
  secureUrl: { type: String },
  storageKey: { type: String, trim: true },
  publicId: { type: String, trim: true },
  resourceType: { type: String, trim: true },
  provider: { type: String, trim: true },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

const SharedFolderUploadSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  type: { type: String, trim: true },
  size: { type: Number, default: 0 },
  relativePath: { type: String, trim: true },
  url: { type: String },
  secureUrl: { type: String },
  storageKey: { type: String, trim: true },
  publicId: { type: String, trim: true },
  resourceType: { type: String, trim: true },
  provider: { type: String, trim: true },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

const ComplianceObservationSchema = new mongoose.Schema({
  srNo: { type: String, trim: true },
  area: { type: String, trim: true },
  observation: { type: String, trim: true },
  potentialRisk: { type: String, trim: true },
  screenshotReference: { type: String, trim: true }
}, { _id: false });

const ComplianceChecklistItemSchema = new mongoose.Schema({
  srNo: { type: String, trim: true },
  part: { type: String, trim: true },
  complianceRequirement: { type: String, trim: true },
  status: { type: String, trim: true },
  remark: { type: String, trim: true }
}, { _id: false });

const ComplianceFinalNoteSchema = new mongoose.Schema({
  conclusion: { type: String, trim: true },
  recommendations: { type: String, trim: true }
}, { _id: false });

const ComplianceHealthReportSchema = new mongoose.Schema({
  yearOfCommencement: { type: String, trim: true },
  establishmentDate: { type: String, trim: true },
  organizationType: { type: String, trim: true },
  keyProductsBrands: { type: String, trim: true },
  sharedFolderUploads: [SharedFolderUploadSchema],
  productCategory: { type: String, trim: true },
  eprRegistrationNumber: { type: String, trim: true },
  financialYearReviewed: { type: String, trim: true },
  objectiveReview: { type: String, trim: true },
  keyObservations: [ComplianceObservationSchema],
  annualReturnObservations: [ComplianceObservationSchema],
  checklistReview: [ComplianceChecklistItemSchema],
  conclusion: { type: String, trim: true },
  recommendations: { type: String, trim: true },
  finalNotes: [ComplianceFinalNoteSchema],
  screenshotReferences: [ScreenshotReferenceSchema],
  reviewedConfirmation: { type: Boolean, default: false },
  submittedAt: { type: Date }
}, { _id: false });

const LeadSchema = new mongoose.Schema({
  leadCode: { type: String, trim: true, unique: true, sparse: true },
  integrationKey: { type: String, trim: true, unique: true, sparse: true, select: false },
  sourceLeadId: { type: String, trim: true },
  communicationMode: { type: String, trim: true },
  status: { type: String, trim: true },
  company: { type: String, trim: true },
  industryType: { type: String, trim: true },
  eprCategory: { type: String, trim: true },
  piboParent: { type: String, enum: ['', 'PIBO', 'SIMP', 'PWP'], trim: true },
  piboCategory: { type: String, trim: true },
  servicesOffered: { type: String, trim: true },
  addressLine1: { type: String, trim: true },
  addressLine2: { type: String, trim: true },
  addressLine3: { type: String, trim: true },
  landmark: { type: String, trim: true },
  state: { type: String, trim: true },
  city: { type: String, trim: true },
  pinCode: { type: String, trim: true },
  gstNumber: { type: String, trim: true, uppercase: true, maxlength: 15 },
  existingClient: { type: String, enum: ['Yes', 'No'], default: 'No' },
  website: { type: String, trim: true },
  salutation: { type: String, trim: true },
  contactPerson: { type: String, trim: true },
  designation: { type: String, trim: true },
  emails: { type: String, trim: true },
  emailsSentCount: { type: Number, default: 0 },
  lastEmailSent: { type: String, trim: true },
  mobileNo1: { type: String, trim: true },
  mobileNo2: { type: String, trim: true },
  businessCardUrl: { type: String },
  referredBy: { type: String, trim: true },
  source: { type: String, trim: true },
  notes: { type: String, trim: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  assignedToText: { type: String, trim: true },
  assignedToEmail: { type: String, trim: true, lowercase: true },
  assignedToCrmUserId: { type: String, trim: true },
  assignedBy: { type: String, trim: true },
  assignedByName: { type: String, trim: true },
  assignedByEmail: { type: String, trim: true, lowercase: true },
  assignedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  assignedAt: { type: Date },
  importedCreatedBy: { type: String, trim: true },
  createdByName: { type: String, trim: true, immutable: true },
  createdByEmail: { type: String, trim: true, lowercase: true, immutable: true },
  createdByCrmUserId: { type: String, trim: true, immutable: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  updatedByName: { type: String, trim: true },
  updatedByEmail: { type: String, trim: true, lowercase: true },
  updatedByCrmUserId: { type: String, trim: true },
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  closedByText: { type: String, trim: true },
  closedByEmail: { type: String, trim: true, lowercase: true },
  closedByCrmUserId: { type: String, trim: true },
  closedAt: { type: Date },
  leadDate: { type: String, trim: true },
  nextFollowUpDate: { type: String, trim: true },
  nextFollowUpTime: { type: String, trim: true },
  followUpRemarks: { type: String, trim: true },
  importedCreatedAt: { type: String, trim: true },
  importedUpdatedAt: { type: String, trim: true },
  importedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  importedByName: { type: String, trim: true },
  importedByEmail: { type: String, trim: true, lowercase: true },
  importedAt: { type: Date },
  complianceHealthReport: ComplianceHealthReportSchema,
  workflowStatus: { type: String, enum: ['draft', 'submitted'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, immutable: true }
}, { timestamps: true });

module.exports = mongoose.model('Lead', LeadSchema);
