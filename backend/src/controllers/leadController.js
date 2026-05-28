const Lead = require('../models/Lead');

const REQUIRED_FIELDS = ['status', 'company', 'piboCategory', 'servicesOffered', 'addressLine1', 'state', 'city', 'pinCode'];

function cleanBody(body) {
  const data = {};
  [
    'communicationMode',
    'status',
    'company',
    'industryType',
    'eprCategory',
    'piboCategory',
    'servicesOffered',
    'addressLine1',
    'addressLine2',
    'addressLine3',
    'landmark',
    'state',
    'city',
    'pinCode',
    'existingClient',
    'website',
    'salutation',
    'contactPerson',
    'designation',
    'emails',
    'mobileNo1',
    'mobileNo2',
    'businessCardUrl',
    'referredBy',
    'source',
    'notes',
    'assignedTo',
    'workflowStatus'
  ].forEach((key) => {
    if (body[key] !== undefined) {
      const value = typeof body[key] === 'string' ? body[key].trim() : body[key];
      if (key === 'assignedTo' && !value) return;
      data[key] = value;
    }
  });
  return data;
}

function validateSubmittedLead(data) {
  const missing = REQUIRED_FIELDS.filter((field) => !data[field]);
  if (missing.length) return `Missing required fields: ${missing.join(', ')}`;
  return '';
}

exports.listLeads = async (req, res) => {
  const leads = await Lead.find().populate('assignedTo', 'name email avatarUrl role').sort({ createdAt: -1 });
  res.json({ ok: true, leads });
};

exports.createLead = async (req, res) => {
  const data = cleanBody(req.body);
  data.workflowStatus = data.workflowStatus === 'submitted' ? 'submitted' : 'draft';

  if (data.workflowStatus === 'submitted') {
    const error = validateSubmittedLead(data);
    if (error) return res.status(400).json({ error });
  }

  const lead = await Lead.create({ ...data, createdBy: req.user?._id });
  res.status(201).json({ ok: true, lead });
};
