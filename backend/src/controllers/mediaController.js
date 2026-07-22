const crypto = require('crypto');

const ALLOWED_MIME = /^(image\/(png|jpeg|gif|webp|svg\+xml)|video\/(mp4|webm|quicktime|x-msvideo)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|vnd\.ms-outlook|octet-stream)|message\/rfc822|text\/(plain|csv))$/i;
const MAX_IMAGE_OR_DOCUMENT = 25 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;

function configuration() {
  const cloudName = String(process.env.CCP_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || '').replace(/\s+/g, '').trim();
  const apiKey = String(process.env.CCP_CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = String(process.env.CCP_CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET || '').trim();
  if (!cloudName || !apiKey || !apiSecret) {
    const error = new Error('Cloudinary is not configured on the server');
    error.statusCode = 503;
    throw error;
  }
  return { cloudName, apiKey, apiSecret };
}

function signature(params, secret) {
  const source = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join('&');
  return crypto.createHash('sha1').update(`${source}${secret}`).digest('hex');
}

function safeSegment(value, fallback) {
  const cleaned = String(value || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return cleaned || fallback;
}

function containsEmbeddedMedia(value, seen = new Set()) {
  if (typeof value === 'string') return /^data:(image|video|audio|application)\/[a-z0-9.+-]+;base64,/i.test(value.trim());
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some((nested) => containsEmbeddedMedia(nested, seen));
}

exports.createUploadSignature = async (req, res) => {
  const { cloudName, apiKey, apiSecret } = configuration();
  const type = String(req.body?.type || '').trim().toLowerCase();
  const size = Number(req.body?.size || 0);
  if (!ALLOWED_MIME.test(type)) return res.status(400).json({ error: `Unsupported file type: ${type || 'unknown'}` });
  const maxSize = type.startsWith('video/') ? MAX_VIDEO : MAX_IMAGE_OR_DOCUMENT;
  if (!Number.isFinite(size) || size <= 0 || size > maxSize) return res.status(400).json({ error: `File exceeds the ${Math.round(maxSize / 1024 / 1024)} MB limit` });

  const timestamp = Math.floor(Date.now() / 1000);
  const section = safeSegment(req.body?.section, 'general');
  const original = safeSegment(String(req.body?.name || '').replace(/\.[^.]+$/, ''), 'file');
  const folder = `ccp/${section}`;
  const publicId = `${original}-${crypto.randomUUID()}`;
  const params = { folder, public_id: publicId, timestamp };
  return res.json({
    ok: true,
    cloudName,
    apiKey,
    resourceType: 'auto',
    uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/auto/upload`,
    params: { ...params, signature: signature(params, apiSecret) }
  });
};

exports.rejectEmbeddedMedia = (req, res, next) => {
  if (req.path === '/api/ccp/clients/bulk') return next();
  if (!['POST', 'PUT', 'PATCH'].includes(req.method) || !containsEmbeddedMedia(req.body)) return next();
  return res.status(400).json({ error: 'Embedded base64 media is not allowed. Upload the file to Cloudinary first.' });
};

exports._test = { signature, safeSegment, containsEmbeddedMedia, ALLOWED_MIME, MAX_IMAGE_OR_DOCUMENT, MAX_VIDEO };
