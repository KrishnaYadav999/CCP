const http = require('http');
const https = require('https');

function getSyncUrl() {
  if (process.env.CRM_USER_SYNC_URL) return process.env.CRM_USER_SYNC_URL;
  if (process.env.CCP_TO_CRM_USER_SYNC_URL) return process.env.CCP_TO_CRM_USER_SYNC_URL;
  if (process.env.CRM_API_BASE_URL) {
    return `${process.env.CRM_API_BASE_URL.replace(/\/+$/, '')}/api/auth/ccp/users/sync`;
  }
  return 'http://localhost:5000/api/auth/ccp/users/sync';
}

function requestJson(url, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const body = JSON.stringify(payload);
    const transport = target.protocol === 'https:' ? https : http;

    const req = transport.request({
      method: 'POST',
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers
      },
      timeout: 8000
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

        const error = new Error(data.error || `CRM sync failed with status ${res.statusCode}`);
        error.statusCode = res.statusCode;
        error.data = data;
        return reject(error);
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('CRM sync request timed out'));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function buildPayload(action, user, password) {
  const email = String(user.email || '').toLowerCase().trim();
  const payload = {
    action,
    ccpUserId: String(user._id),
    name: user.name || '',
    email,
    role: user.role || 'operation',
    team: user.team || 'No team assigned',
    teamId: user.teamId || '',
    managerId: user.managerId ? String(user.managerId) : '',
    operationHeadId: user.operationHeadId ? String(user.operationHeadId) : '',
    avatarUrl: user.avatarUrl || '',
    isActive: user.isActive !== false,
    source: 'ccp'
  };

  if (action === 'create' && password && String(password).length >= 8) {
    payload.password = password;
  }
  return payload;
}

async function syncUserToCrm(action, user, options = {}) {
  const url = getSyncUrl();
  if (!url) return { skipped: true, reason: 'CRM_USER_SYNC_URL not configured' };

  const secret = process.env.CRM_SHARED_SECRET || process.env.CCP_SHARED_SECRET;
  const headers = {};
  if (secret) headers['x-ccp-secret'] = secret;

  const payload = buildPayload(action, user, options.password);
  const response = await requestJson(url, payload, headers);
  return { ok: true, statusCode: response.statusCode, data: response.data };
}

module.exports = { syncUserToCrm };
