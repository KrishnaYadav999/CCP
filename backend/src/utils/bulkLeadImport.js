function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

const HEADER_ALIASES = {
  assignedby: 'assignedBy', assignedbyname: 'assignedBy', assignedbyemail: 'assignedByEmail',
  createdby: 'importedCreatedBy', createdbyname: 'importedCreatedBy', createdbyemail: 'createdByEmail',
  assignedto: 'assignedToText', assignto: 'assignedToText', assignedtotext: 'assignedToText', assignedtoemail: 'assignedToEmail',
  createdat: 'importedCreatedAt', updatedat: 'importedUpdatedAt'
};

function canonicalizeBulkRow(row, allowedFields) {
  const allowed = new Set(allowedFields);
  const canonical = new Map(allowedFields.map((field) => [normalizeHeader(field), field]));
  const data = {};
  const unknown = [];
  for (const [header, value] of Object.entries(row || {})) {
    const normalized = normalizeHeader(header);
    const field = allowed.has(header) ? header : (HEADER_ALIASES[normalized] || canonical.get(normalized));
    if (!field) unknown.push(header);
    else data[field] = value;
  }
  return { data, unknown };
}

function parseImportDate(value) {
  if (value === '' || value === null || value === undefined) return { value: '' };
  let date = null;
  if (value instanceof Date) date = value;
  else if (typeof value === 'number' && Number.isFinite(value)) date = new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86400000));
  else {
    const raw = String(value).trim();
    const dmy = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})(?:\s+.*)?$/);
    if (dmy) date = new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])));
    else date = new Date(raw);
  }
  return Number.isNaN(date?.getTime()) ? { value, warning: `Invalid date "${String(value)}"` } : { value: date.toISOString() };
}

function normalizeBulkDates(data) {
  const warnings = [];
  for (const field of ['importedCreatedAt', 'importedUpdatedAt', 'assignedAt']) {
    if (data[field] === undefined || data[field] === '') continue;
    const parsed = parseImportDate(data[field]);
    if (parsed.warning) {
      warnings.push({ field, warning: parsed.warning });
      if (field === 'assignedAt') delete data[field];
      else data[field] = String(data[field]);
    } else data[field] = parsed.value;
  }
  return warnings;
}

module.exports = { normalizeHeader, canonicalizeBulkRow, parseImportDate, normalizeBulkDates };
