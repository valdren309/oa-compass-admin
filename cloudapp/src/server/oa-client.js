// oa-client.js
'use strict';

const https = require('https');
const { URL } = require('url');
const {
  OA_BASE_URL,
  OA_TENANT,
  OA_API_KEY,
  OA_USERNAME_PREFIX,
} = require('./config');

function httpPostJsonWithKey(urlStr, apiKey, payload, contentType = 'application/json') {
  const u = new URL(urlStr);
  const data = JSON.stringify(payload || {});
  const opts = {
    method: 'POST',
    hostname: u.hostname,
    port: u.port || 443,
    path: u.pathname + u.search,
    headers: {
      'Authorization': `OAApiKey ${apiKey}`,
      'Accept': 'application/json',
      'Content-Type': contentType,
      'Content-Length': Buffer.byteLength(data),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(d || '{}') });
        } catch {
          resolve({ status: res.statusCode, body: d });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpGetJsonWithKey(urlStr, apiKey) {
  const u = new URL(urlStr);
  const opts = {
    method: 'GET',
    hostname: u.hostname,
    port: u.port || 443,
    path: u.pathname + u.search,
    headers: {
      'Authorization': `OAApiKey ${apiKey}`,
      'Accept': 'application/json',
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(d || '{}') });
        } catch {
          resolve({ status: res.statusCode, body: d });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Ensure OA username has the required prefix (e.g., "iast-")
function normalizeUsername(u) {
  let s = (u || '').trim();
  if (!s) return s;
  if (OA_USERNAME_PREFIX && !s.startsWith(OA_USERNAME_PREFIX)) {
    s = OA_USERNAME_PREFIX + s;
  }
  return s;
}

// Query OA by username or email; returns {status, body}
async function queryAccount({ username, email }) {
  const u = normalizeUsername(username);
  const q = u
    ? `username=${encodeURIComponent(u)}`
    : `email=${encodeURIComponent((email || '').trim())}`;
  const url = `${OA_BASE_URL}/v1/${OA_TENANT}/account/query?${q}`;
  return httpGetJsonWithKey(url, OA_API_KEY);
}

// Resolve an OA account id from { openathensId | username | email }
async function resolveAccountIdOrThrow({ openathensId, username, email }) {
  if (!OA_BASE_URL || !OA_TENANT || !OA_API_KEY) {
    const err = new Error('OA config missing');
    err.code = 'OA_CONFIG_MISSING';
    throw err;
  }

  if (openathensId) {
    return openathensId.trim();
  }

  let u = username ? String(username).trim() : '';
  const e = email ? String(email).trim() : '';

  if (!u && !e) {
    const err = new Error('openathens_id or (username/email) required');
    err.code = 'OA_INPUT_MISSING';
    throw err;
  }

  if (u && OA_USERNAME_PREFIX && !u.startsWith(OA_USERNAME_PREFIX)) {
    u = OA_USERNAME_PREFIX + u;
  }

  const q = u
    ? `username=${encodeURIComponent(u)}`
    : `email=${encodeURIComponent(e)}`;

  const { status, body } = await httpGetJsonWithKey(
    `${OA_BASE_URL}/v1/${OA_TENANT}/account/query?${q}`,
    OA_API_KEY
  );

  if (status === 404) {
    const err = new Error(`account not found for ${u ? 'username' : 'email'}`);
    err.code = 'OA_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (status < 200 || status >= 300) {
    const err = new Error(`OA lookup error (${status})`);
    err.code = 'OA_LOOKUP_ERROR';
    err.status = status;
    err.details = body;
    throw err;
  }

  const acct = Array.isArray(body)
    ? body[0]
    : (body?.results?.[0] || body);

  if (!acct?.id) {
    const err = new Error('account not found (empty response)');
    err.code = 'OA_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  return acct.id;
}

module.exports = {
  httpPostJsonWithKey,
  httpGetJsonWithKey,
  normalizeUsername,
  queryAccount,
  resolveAccountIdOrThrow,
};
