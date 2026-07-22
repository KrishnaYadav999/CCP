const Quotation = require('../models/Quotation');
const Lead = require('../models/Lead');
const PiboCategory = require('../models/PiboCategory');
const ServiceCategory = require('../models/ServiceCategory');

const normalizeCategory = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

function cleanQuotation(body, user, source) {
  const items = Array.isArray(body.items) ? body.items : [];
  const subtotal = items.reduce((sum, item) => sum + Math.max(1, Number(item.unit) || 1) * Math.max(0, Number(item.basicAmount) || 0), 0);
  return {
    selectedLead: body.selectedLead,
    companyName: String(body.companyName || '').trim(),
    quotationNumber: String(body.quotationNumber || '').trim(),
    quotationDate: String(body.quotationDate || '').trim(),
    validUntil: String(body.validUntil || '').trim(),
    items,
    terms: (Array.isArray(body.terms) ? body.terms : []).map((term) => String(term || '').trim()).filter(Boolean),
    subtotal,
    grandTotal: subtotal,
    status: body.status === 'draft' ? 'draft' : 'submitted',
    source,
    updatedBy: user?._id
  };
}

function validateQuotation(row) {
  if (!row.selectedLead) return 'Selected lead is required';
  if (!row.companyName) return 'Company name is required';
  if (!row.quotationNumber) return 'Quotation number is required';
  if (!row.validUntil) return 'Quotation valid-until date is required';
  if (!row.items.length) return 'At least one quotation item is required';
  return '';
}

exports.list = async (req, res) => {
  const quotations = await Quotation.find().populate('selectedLead', 'leadCode company contactPerson').sort({ updatedAt: -1 });
  res.json({ ok: true, quotations });
};

exports.listPiboCategories = async (req, res) => {
  const categories = await PiboCategory.find().sort({ parent: 1, name: 1 }).select('name parent');
  res.json({ ok: true, categories: categories.map((category) => ({ name: category.name, parent: category.parent })) });
};

exports.createPiboCategory = async (req, res) => {
  const name = String(req.body.name || '').trim().replace(/\s+/g, ' ');
  const parent = ['PIBO', 'SIMP', 'PWP'].includes(req.body.parent) ? req.body.parent : 'PIBO';
  if (!name) return res.status(400).json({ error: 'PIBO category name is required' });
  if (name.length > 60) return res.status(400).json({ error: 'PIBO category must be 60 characters or fewer' });
  const category = await PiboCategory.findOneAndUpdate(
    { normalizedName: `${parent.toLowerCase()}:${normalizeCategory(name)}` },
    { $setOnInsert: { name, parent, normalizedName: `${parent.toLowerCase()}:${normalizeCategory(name)}`, createdBy: req.user?._id } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.status(201).json({ ok: true, category: { name: category.name, parent: category.parent } });
};

exports.listServiceCategories = async (req, res) => {
  const categories = await ServiceCategory.find().sort({ name: 1 }).select('name');
  res.json({ ok: true, categories: categories.map((category) => category.name) });
};

exports.createServiceCategory = async (req, res) => {
  const name = String(req.body.name || '').trim().replace(/\s+/g, ' ');
  if (!name) return res.status(400).json({ error: 'Service category name is required' });
  if (name.length > 60) return res.status(400).json({ error: 'Service category must be 60 characters or fewer' });
  const category = await ServiceCategory.findOneAndUpdate(
    { normalizedName: normalizeCategory(name) },
    { $setOnInsert: { name, normalizedName: normalizeCategory(name), createdBy: req.user?._id } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.status(201).json({ ok: true, category: category.name });
};

exports.upsert = async (req, res) => {
  const row = cleanQuotation(req.body, req.user, req.body.source === 'bulk' ? 'bulk' : 'manual');
  const validationError = validateQuotation(row);
  if (validationError) return res.status(400).json({ error: validationError });
  const lead = await Lead.findById(row.selectedLead).select('_id company');
  if (!lead) return res.status(400).json({ error: 'Selected lead does not exist' });
  row.companyName = lead.company || row.companyName;
  const quotation = await Quotation.findOneAndUpdate(
    { selectedLead: row.selectedLead, quotationNumber: row.quotationNumber },
    { $set: row, $setOnInsert: { createdBy: req.user?._id } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.status(201).json({ ok: true, quotation });
};

exports.bulkUpsert = async (req, res) => {
  const input = Array.isArray(req.body.quotations) ? req.body.quotations : [];
  if (!input.length) return res.status(400).json({ error: 'No quotations provided' });
  const leadIds = [...new Set(input.map((row) => String(row.selectedLead || '')).filter(Boolean))];
  const leads = await Lead.find({ _id: { $in: leadIds } }).select('_id company');
  const leadMap = new Map(leads.map((lead) => [String(lead._id), lead]));
  const failures = [];
  const operations = [];
  input.forEach((body, index) => {
    const row = cleanQuotation(body, req.user, 'bulk');
    const lead = leadMap.get(String(row.selectedLead));
    const validationError = validateQuotation(row) || (!lead ? 'Selected lead does not exist' : '');
    if (validationError) { failures.push({ row: index + 1, error: validationError }); return; }
    row.companyName = lead.company || row.companyName;
    operations.push({ updateOne: {
      filter: { selectedLead: row.selectedLead, quotationNumber: row.quotationNumber },
      update: { $set: row, $setOnInsert: { createdBy: req.user?._id } },
      upsert: true
    } });
  });
  if (!operations.length) return res.status(400).json({ error: failures[0]?.error || 'No valid quotations found', failures });
  const result = await Quotation.bulkWrite(operations, { ordered: false });
  res.status(201).json({
    ok: failures.length === 0,
    imported: operations.length,
    created: result.upsertedCount || 0,
    updated: result.modifiedCount || result.matchedCount || 0,
    failed: failures.length,
    failures
  });
};
