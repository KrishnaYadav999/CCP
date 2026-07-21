function requireCcpSharedKey(req, res, next) {
  const expectedKeys = [
    process.env.CCP_SHARED_SECRET,
    process.env.CCP_API_KEY,
    process.env.CCP_SHARED_API_KEY
  ].filter(Boolean);

  if (!expectedKeys.length) {
    return res.status(503).json({ ok: false, error: 'CCP integration credential is not configured' });
  }

  const providedKeys = [req.get('x-ccp-secret'), req.get('x-ccp-api-key')].filter(Boolean);
  if (!providedKeys.some((key) => expectedKeys.includes(key))) {
    return res.status(401).json({ ok: false, error: 'Invalid CCP integration credential' });
  }

  return next();
}

module.exports = requireCcpSharedKey;
