require('dotenv').config();
const crypto = require('crypto');
const connectDB = require('../src/config/db');
const Client = require('../src/models/Client');
const Lead = require('../src/models/Lead');
const User = require('../src/models/User');

const cloudName = String(process.env.CCP_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || '').replace(/\s+/g, '');
const apiKey = process.env.CCP_CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CCP_CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET;

function sign(params) {
  const source = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join('&');
  return crypto.createHash('sha1').update(`${source}${apiSecret}`).digest('hex');
}

async function uploadDataUrl(dataUrl, section) {
  const match = String(dataUrl).match(/^data:([^;,]+);base64,(.+)$/s);
  if (!match) return null;
  const [, mime, encoded] = match;
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder: `ccp/${section}`, public_id: `legacy-${crypto.randomUUID()}`, timestamp };
  const form = new FormData();
  form.append('file', new Blob([Buffer.from(encoded, 'base64')], { type: mime }), `legacy-${Date.now()}`);
  form.append('api_key', apiKey);
  Object.entries(params).forEach(([key, value]) => form.append(key, String(value)));
  form.append('signature', sign(params));
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/auto/upload`, { method: 'POST', body: form });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'Cloudinary migration upload failed');
  return { url: result.secure_url, secureUrl: result.secure_url, storageKey: result.public_id, publicId: result.public_id, resourceType: result.resource_type, format: result.format || '', size: result.bytes, provider: 'cloudinary', uploadedAt: result.created_at };
}

async function migrateValue(value, section, parent, key) {
  if (typeof value === 'string' && /^data:(image|video|audio|application)\//i.test(value)) {
    const uploaded = await uploadDataUrl(value, section);
    if (parent && key === 'avatarUrl') return uploaded.url;
    if (parent && key === 'businessCardUrl') return uploaded.url;
    return uploaded;
  }
  if (!value || typeof value !== 'object') return value;
  if (typeof value.dataUrl === 'string' && /^data:/i.test(value.dataUrl)) {
    const uploaded = await uploadDataUrl(value.dataUrl, section);
    const next = { ...value, ...uploaded };
    delete next.dataUrl;
    return next;
  }
  if (Array.isArray(value)) {
    const output = [];
    for (let index = 0; index < value.length; index += 1) output.push(await migrateValue(value[index], section, value, index));
    return output;
  }
  const output = { ...value };
  for (const nestedKey of Object.keys(output)) output[nestedKey] = await migrateValue(output[nestedKey], section, output, nestedKey);
  return output;
}

async function run() {
  if (!cloudName || !apiKey || !apiSecret) throw new Error('Cloudinary environment variables are required');
  await connectDB();
  let migrated = 0;
  for (const client of await Client.find({})) {
    const next = await migrateValue(client.data?.toObject?.() || client.data, 'legacy-client-media');
    if (JSON.stringify(next) !== JSON.stringify(client.data)) { client.data = next; client.markModified('data'); await client.save(); migrated += 1; }
  }
  for (const lead of await Lead.find({})) {
    const current = lead.toObject();
    const nextReport = await migrateValue(current.complianceHealthReport, 'legacy-lead-media');
    const nextCard = await migrateValue(current.businessCardUrl, 'legacy-lead-media', current, 'businessCardUrl');
    if (JSON.stringify(nextReport) !== JSON.stringify(current.complianceHealthReport) || nextCard !== current.businessCardUrl) { lead.complianceHealthReport = nextReport; lead.businessCardUrl = nextCard; await lead.save(); migrated += 1; }
  }
  for (const user of await User.find({ avatarUrl: /^data:/ })) { user.avatarUrl = await migrateValue(user.avatarUrl, 'legacy-user-avatars', user, 'avatarUrl'); await user.save(); migrated += 1; }
  console.log(`Cloudinary media migration complete. Updated ${migrated} records.`);
  process.exit(0);
}

run().catch((error) => { console.error(error.message); process.exit(1); });
