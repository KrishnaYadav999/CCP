const http = require('http');
const https = require('https');

function joinUrl(baseUrl, path) {
  return `${String(baseUrl || '').replace(/\/+$/, '')}/${String(path || '').replace(/^\/+/, '')}`;
}

function getCrmBackendUrl() {
  return process.env.CRM_BACKEND_URL || process.env.CRM_API_BASE_URL || '';
}

function getSharedSecret() {
  return process.env.CCP_SHARED_SECRET || process.env.CRM_SHARED_SECRET || '';
}

function requestJson(url, { method = 'POST', payload, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const body = payload === undefined ? '' : JSON.stringify(payload);
    const transport = target.protocol === 'https:' ? https : http;

    const requestHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (body) requestHeaders['Content-Length'] = Buffer.byteLength(body);

    const req = transport.request({
      method,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      headers: requestHeaders,
      timeout: 10000
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        let data = {};
        if (raw) {
          try {
            data = JSON.parse(raw);
          } catch {
            data = { raw };
          }
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          return resolve({ statusCode: res.statusCode, data });
        }

        const error = new Error(data.error || data.message || `CRM request failed with status ${res.statusCode}`);
        error.statusCode = res.statusCode;
        error.data = data;
        return reject(error);
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('CRM request timed out'));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function crmHeaders() {
  const secret = getSharedSecret();
  return secret ? { 'x-ccp-secret': secret } : {};
}

module.exports = {
  crmHeaders,
  getCrmBackendUrl,
  getSharedSecret,
  joinUrl,
  requestJson
};
