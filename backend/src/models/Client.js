const mongoose = require('mongoose');

function readFirstPresentValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');
}

function normalizeClientData(data = {}) {
  const basic = { ...(data.basic || {}) };
  const onboardingYear = readFirstPresentValue(
    basic.onboardingYear,
    basic.clientOnboardingYear,
    data.onboardingYear,
    data.clientOnboardingYear
  );
  const firstAnnualReturnYear = readFirstPresentValue(
    basic.firstAnnualReturnYear,
    basic.firstAnnualReturnYearApplicable,
    basic.firstAnnualReturnYearPplicable,
    basic.annualReturnYearApplicable,
    basic.annualReturnYearPplicable,
    basic.annualReturnYear,
    data.firstAnnualReturnYear,
    data.firstAnnualReturnYearApplicable,
    data.firstAnnualReturnYearPplicable,
    data.annualReturnYearApplicable,
    data.annualReturnYearPplicable,
    data.annualReturnYear
  );

  if (onboardingYear !== undefined) {
    basic.onboardingYear = String(onboardingYear).trim();
  }

  if (firstAnnualReturnYear !== undefined) {
    basic.firstAnnualReturnYear = String(firstAnnualReturnYear).trim();
  }

  delete basic.clientOnboardingYear;
  delete basic.firstAnnualReturnYearApplicable;
  delete basic.firstAnnualReturnYearPplicable;
  delete basic.annualReturnYearApplicable;
  delete basic.annualReturnYearPplicable;
  delete basic.annualReturnYear;

  const normalized = {
    ...data,
    basic
  };

  delete normalized.onboardingYear;
  delete normalized.clientOnboardingYear;
  delete normalized.firstAnnualReturnYear;
  delete normalized.firstAnnualReturnYearApplicable;
  delete normalized.firstAnnualReturnYearPplicable;
  delete normalized.annualReturnYearApplicable;
  delete normalized.annualReturnYearPplicable;
  delete normalized.annualReturnYear;

  return normalized;
}

const ClientSchema = new mongoose.Schema({
  selectedLead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  adminControls: {
    approvalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    visibilityStatus: { type: String, default: 'LIVE' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedToText: { type: String, trim: true },
    assignedToEmail: { type: String, trim: true, lowercase: true },
    assignedToCrmUserId: { type: String, trim: true }
  },
  approvalMeta: {
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'] },
    actionAt: { type: Date },
    actionBy: { type: String, trim: true },
    remarks: { type: String, trim: true }
  },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  onboardingYear: { type: String, trim: true },
  firstAnnualReturnYear: { type: String, trim: true },
  workflowStatus: { type: String, enum: ['draft', 'submitted'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByName: { type: String, trim: true },
  createdByEmail: { type: String, trim: true, lowercase: true },
  createdByCrmUserId: { type: String, trim: true }
}, { timestamps: true });

ClientSchema.pre('validate', function normalizeDataBeforeValidate(next) {
  this.data = normalizeClientData(this.data || {});
  this.onboardingYear = this.data?.basic?.onboardingYear || undefined;
  this.firstAnnualReturnYear = this.data?.basic?.firstAnnualReturnYear || undefined;
  this.markModified('data');
  next();
});

module.exports = mongoose.model('Client', ClientSchema);
