const crypto = require('crypto');

function strictCcpApiKey(req, res, next) {
  const expected = String(process.env.CCP_SHARED_API_KEY || '').trim();
  if (!expected) return res.status(503).json({ ok: false, error: 'CCP_SHARED_API_KEY is not configured' });
  const provided = String(req.get('x-ccp-api-key') || '').trim();
  const supplied = Buffer.from(provided);
  const configured = Buffer.from(expected);
  if (!provided || supplied.length !== configured.length || !crypto.timingSafeEqual(supplied, configured)) return res.status(401).json({ ok: false, error: 'Invalid CCP API key' });
  return next();
}

module.exports = strictCcpApiKey;
