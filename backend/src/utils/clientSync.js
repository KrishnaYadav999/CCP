const crypto = require('crypto');

const INVALID = new Set(['', 'n/a', 'na', '-', 'null', 'none', 'nil', 'not applicable']);
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function displayIdentity(value) {
  const text = String(value ?? '').trim();
  return INVALID.has(text.toLowerCase()) ? '' : text;
}

function normalizeIdentity(value) {
  return displayIdentity(value).toLowerCase();
}

function identitiesFromClient(row = {}) {
  const meta = row.data?.importMeta || row.importMeta || {};
  const display = {
    uniqueId: displayIdentity(meta.uniqueId || row.uniqueId),
    ccpClientId: displayIdentity(meta.ccpClientId || row.ccpClientId),
    crmClientId: displayIdentity(meta.crmClientId || meta.sourceClientId || row.crmClientId),
    leadNumber: displayIdentity(meta.leadNumber || row.leadNumber)
  };
  const normalized = Object.fromEntries(Object.entries(display).map(([key, value]) => [key, normalizeIdentity(value)]));
  const primary = normalized.uniqueId || normalized.ccpClientId || normalized.crmClientId || normalized.leadNumber;
  return { display, normalized, primary, primaryDisplay: display.uniqueId || display.ccpClientId || display.crmClientId || display.leadNumber };
}

function isMeaningful(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function fileIdentity(value) {
  if (!value || typeof value !== 'object') return '';
  return normalizeIdentity(value.publicId || value.storageKey || value.secureUrl || value.url);
}

function mergeArrays(existing = [], incoming = []) {
  if (!incoming.length) return existing;
  const output = existing.map((item) => item && typeof item === 'object' ? { ...item } : item);
  for (const item of incoming) {
    if (!isMeaningful(item)) continue;
    const mediaKey = fileIdentity(item?.file || item);
    const key = mediaKey || normalizeIdentity(item?.id || item?._id) || JSON.stringify(item);
    const matchIndex = output.findIndex((candidate) => {
      const candidateMediaKey = fileIdentity(candidate?.file || candidate);
      const candidateKey = candidateMediaKey || normalizeIdentity(candidate?.id || candidate?._id) || JSON.stringify(candidate);
      return candidateKey === key;
    });
    if (matchIndex >= 0 && item && typeof item === 'object' && output[matchIndex] && typeof output[matchIndex] === 'object') {
      output[matchIndex] = deepMerge(output[matchIndex], item);
    } else if (matchIndex < 0) output.push(item);
  }
  return output;
}

function deepMerge(existing, incoming) {
  if (!isMeaningful(incoming)) return existing;
  if (Array.isArray(incoming)) return mergeArrays(Array.isArray(existing) ? existing : [], incoming);
  if (incoming && typeof incoming === 'object') {
    const output = existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
    for (const [key, value] of Object.entries(incoming)) {
      if (UNSAFE_KEYS.has(key)) continue;
      if (!isMeaningful(value)) continue;
      output[key] = deepMerge(output[key], value);
    }
    return output;
  }
  return incoming;
}

function containsBase64(value, seen = new Set()) {
  if (typeof value === 'string') return /^data:[^;,]+;base64,/i.test(value.trim());
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some((nested) => containsBase64(nested, seen));
}

function failureKey(row, index) {
  const identities = identitiesFromClient(row);
  return identities.primary || `row:${crypto.createHash('sha256').update(`${index}:${JSON.stringify(row || {})}`).digest('hex')}`;
}

module.exports = { displayIdentity, normalizeIdentity, identitiesFromClient, isMeaningful, fileIdentity, deepMerge, containsBase64, failureKey };
