'use strict';
const http = require('http');
const https = require('https');
const { URL } = require('url');

/* ====== CONFIG (from systemd env or /opt/oa-proxy/.env) ====== */
const PORT = 8081;

// CORS allowlist: comma-separated origins in .env, e.g.:
// ALLOWED_ORIGINS=https://sandbox-na.alma.exlibrisgroup.com,https://na02.alma.exlibrisgroup.com
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

// OpenAthens Admin API (API key auth, NOT OAuth)
// OA_BASE_URL=https://admin.openathens.net/api
// OA_TENANT=iastate.edu
// OA_API_KEY=xxxxx
const OA_BASE_URL = process.env.OA_BASE_URL || '';
const OA_TENANT   = process.env.OA_TENANT   || '';
const OA_API_KEY  = process.env.OA_API_KEY  || '';
const OA_USERNAME_PREFIX = process.env.OA_USERNAME_PREFIX || 'iast-';

// Alma user class → OA groups/permissionSets
const GROUP_MAP = {
  retiree:       { groups: ['retiree'],       permissionSets: ['iast#mylibrarycardil'] },
  foundation:    { groups: ['foundation'],    permissionSets: ['iast#mylibrarycardil'] },
  emeritus:      { groups: ['emeritus'],      permissionSets: ['iast#mylibrarycardil'] },
  affiliate:     { groups: ['affiliate'],     permissionSets: ['iast#mylibrarycardil'] },
  visitscholar:  { groups: ['visitscholar'],  permissionSets: ['iast#mylibrarycardil'] },
  paid_vc:       { groups: ['paid_vc'],       permissionSets: ['iast#mylibrarycardil'] },
  free_vc:       { groups: ['free_vc'],       permissionSets: ['iast#mylibrarycard']  },
  spouse:        { groups: ['spouse'],        permissionSets: ['iast#mylibrarycardil'] },
  alumniassoc:   { groups: ['alumniassoc'],   permissionSets: ['iast#mylibrarycardil'] },
  xmur:          { groups: ['xmur'],          permissionSets: ['iast#mylibrarycardil'] }
};

// Optional: map specific Alma group *codes* to a key above
const CODE_TO_KEY = {
  "05": "retiree",
  "52": "foundation",
  "53": "emeritus",
  "56": "affiliate",
  "57": "xmur",
  "58": "visitscholar",
  "61": "free_vc",
  "62": "paid_vc",
  "63": "spouse"
};

/* ====== helpers ====== */
function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function derivePolicy({ alma_group_key, alma_group_code }) {
  if (alma_group_key && GROUP_MAP[alma_group_key]) return GROUP_MAP[alma_group_key];
  if (alma_group_code && CODE_TO_KEY[alma_group_code] && GROUP_MAP[CODE_TO_KEY[alma_group_code]]) {
    return GROUP_MAP[CODE_TO_KEY[alma_group_code]];
  }
  return null; // no mapping; caller may supply groups/permissionSets explicitly
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 200*1024) return reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

// POST JSON with OAApiKey
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
      'Content-Length': Buffer.byteLength(data)
    }
  };
  return new Promise((resolve, reject) => {
    const req = require('https').request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d || '{}') }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// GET with OAApiKey header
function httpGetJsonWithKey(urlStr, apiKey) {
  const u = new URL(urlStr);
  const opts = {
    method: 'GET',
    hostname: u.hostname,
    port: u.port || 443,
    path: u.pathname + u.search,
    headers: {
      'Authorization': `OAApiKey ${apiKey}`,
      'Accept': 'application/json'
    }
  };
  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d || '{}') }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Resolve an OA account id from { openathensId | username | email }, applying OA_USERNAME_PREFIX to username
async function resolveAccountIdOrThrow({ openathensId, username, email }) {
  if (!OA_BASE_URL || !OA_TENANT || !OA_API_KEY) {
    const err = new Error('OA config missing');
    err.code = 'OA_CONFIG_MISSING';
    throw err;
  }
  if (openathensId) return openathensId.trim();

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

  const q = u ? `username=${encodeURIComponent(u)}` : `email=${encodeURIComponent(e)}`;
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
  const q = u ? `username=${encodeURIComponent(u)}` : `email=${encodeURIComponent((email||'').trim())}`;
  const url = `${OA_BASE_URL}/v1/${OA_TENANT}/account/query?${q}`;
  return httpGetJsonWithKey(url, OA_API_KEY);
}

/* ====== server ====== */
const server = http.createServer(async (req, res) => {
  setCors(req, res);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // Health
  if (req.url === '/health' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, service: 'oa-proxy', time: new Date().toISOString() });
  }

  // ===== VERIFY (username OR email) =====
  if (req.url === '/v1/oa/users/verify' && req.method === 'POST') {
    try {
      if (!OA_BASE_URL) return sendJson(res, 500, { error: 'OA_BASE_URL not set' });
      if (!OA_TENANT)   return sendJson(res, 500, { error: 'OA_TENANT not set' });
      if (!OA_API_KEY)  return sendJson(res, 500, { error: 'OA_API_KEY not set' });

      const bodyIn = await readJsonBody(req);
      const vUsername = bodyIn?.username;
      const vEmail    = bodyIn?.email;
      if (!vUsername && !vEmail) return sendJson(res, 400, { error: 'username or email required' });

      const { status: qStatus, body: qBody } = await queryAccount({ username: vUsername, email: vEmail });

      if (qStatus === 404) {
        return sendJson(res, 200, {
          found: false,
          normalizedUsername: normalizeUsername(vUsername) || null,
          raw: { status: 404 }
        });
      }

      if (qStatus < 200 || qStatus >= 300) {
        const code = qBody?.code || null;
        const message = qBody?.message || 'OA query failed';
        return sendJson(res, qStatus, {
          error: 'OA query failed',
          code,
          message,
          status: qStatus
        });
      }

      const total = (qBody && (qBody.total ?? qBody.count ?? (Array.isArray(qBody) ? qBody.length : 0))) || 0;
      return sendJson(res, 200, {
        found: total > 0,
        normalizedUsername: normalizeUsername(vUsername) || null,
        raw: qBody
      });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || 'verify failed' });
    }
  }

  // ===== GET first matching OA account (by username OR email) =====
  if (req.url === '/v1/oa/users/get' && req.method === 'POST') {
    try {
      if (!OA_BASE_URL) return sendJson(res, 500, { error: 'OA_BASE_URL not set' });
      if (!OA_TENANT)   return sendJson(res, 500, { error: 'OA_TENANT not set' });
      if (!OA_API_KEY)  return sendJson(res, 500, { error: 'OA_API_KEY not set' });

      const bodyGet = await readJsonBody(req);
      const gUsername = bodyGet?.username;
      const gEmail    = bodyGet?.email;
      if (!gUsername && !gEmail) return sendJson(res, 400, { error: 'username or email required' });

      const { status: getStatus, body: getResp } = await queryAccount({ username: gUsername, email: gEmail });

      if (getStatus === 404) {
        return sendJson(res, 404, {
          error: 'not found',
          normalizedUsername: normalizeUsername(gUsername) || null
        });
      }

      if (getStatus < 200 || getStatus >= 300) {
        const code = getResp?.code || null;
        const message = getResp?.message || 'OA query failed';
        return sendJson(res, getStatus, {
          error: 'OA query failed',
          code,
          message,
          status: getStatus
        });
      }

      let account = null;
      if (Array.isArray(getResp) && getResp.length) account = getResp[0];
      else if (getResp?.results?.length)           account = getResp.results[0];
      else if (getResp && typeof getResp === 'object') account = getResp;

      if (!account) {
        return sendJson(res, 404, {
          error: 'not found',
          normalizedUsername: normalizeUsername(gUsername) || null
        });
      }

      return sendJson(res, 200, {
        account,
        normalizedUsername: normalizeUsername(gUsername) || null
      });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || 'get failed' });
    }
  }

  // ===== CREATE (maps Alma → OA; default status "pending") =====
  if (req.url === '/v1/oa/users/create' && req.method === 'POST') {
    try {
      if (!OA_API_KEY)  return sendJson(res, 500, { error: 'OA_API_KEY not set' });
      const createUrlEnv = process.env.OA_CREATE_URL;
      if (!createUrlEnv) return sendJson(res, 500, { error: 'OA_CREATE_URL not set' });

      const bodyIn = await readJsonBody(req);

      // Simple inputs
      // username is now optional; OA will generate it if omitted
      const cEmail    = bodyIn.email?.trim();
      const cFirst    = bodyIn.first_name?.trim();
      const cLast     = bodyIn.last_name?.trim();
      const cExpiry   = bodyIn.expires?.trim(); // YYYY-MM-DD
      const cPassword = bodyIn.password ? String(bodyIn.password) : undefined;

      // Alma class hints
      const cKey  = bodyIn.alma_group_key?.trim() || '';
      const cCode = bodyIn.alma_group_code != null ? String(bodyIn.alma_group_code).trim() : '';

      // Default to "pending" (your chosen behavior)
      let cStatus = (bodyIn.status ? String(bodyIn.status) : 'pending').toLowerCase();
      if (cStatus === 'active' && !cPassword) cStatus = 'pending';

      // Validate
      const errs = {};
      if (!cEmail || !cEmail.includes('@')) errs.email = 'invalid';
      if (!cFirst) errs.first_name = 'required';
      if (!cLast) errs.last_name = 'required';
      if (!cExpiry) errs.expires = 'required';
      if (Object.keys(errs).length) return sendJson(res, 400, { error: 'invalid input', invalid: errs });

      // Build OA payload WITHOUT username so OA can generate it
      const oaBody = {
        status: cStatus,                 // "pending" by default
        expiryDate: cExpiry,
        attributes: {
          forenames: cFirst,
          surname:   cLast,
          emailAddress: cEmail,
          uniqueEmailAddress: cEmail
        }
      };
      if (cPassword) oaBody.password = cPassword;

      // Apply mapping (code → key → policy)
      const policy = derivePolicy({ alma_group_key: cKey, alma_group_code: cCode });
      if (policy && !Array.isArray(bodyIn.groups) && !Array.isArray(bodyIn.permissionSets)) {
        oaBody.groups = policy.groups;
        oaBody.permissionSets = policy.permissionSets;
      }
      // Explicit overrides from caller (if provided)
      if (Array.isArray(bodyIn.groups) && bodyIn.groups.length) oaBody.groups = bodyIn.groups;
      if (Array.isArray(bodyIn.permissionSets) && bodyIn.permissionSets.length) oaBody.permissionSets = bodyIn.permissionSets;

      // POST with vendor media type
      const { status: createStatus, body: createResp } = await httpPostJsonWithKey(
        createUrlEnv,
        OA_API_KEY,
        oaBody,
        'application/vnd.eduserv.iam.admin.accountRequest-v1+json'
      );

      // Heuristic: treat 409 or certain 400s as "already exists"
      const respText = typeof createResp === 'string'
        ? createResp
        : JSON.stringify(createResp || {});
      const lower = respText.toLowerCase();

      const looksLikeExists =
        lower.includes('already exist') ||
        lower.includes('duplicate') ||
        lower.includes('uniqueemail') ||
        lower.includes('unique email');

      if (createStatus === 409 || (createStatus === 400 && looksLikeExists)) {
        return sendJson(res, 200, {
          created: false,
          alreadyExists: true,
          raw: createResp,
          reason: 'OpenAthens account already exists'
        });
      }

      if (createStatus < 200 || createStatus >= 300) {
        const code = createResp?.code || null;
        const message = createResp?.message || 'OA create failed';
        return sendJson(res, createStatus, {
          error: 'OA create failed',
          code,
          message,
          status: createStatus
        });
      }

      const summary = {
        id: createResp?.id,
        username: createResp?.username,
        status: createResp?.status,
        expiry:  createResp?.expiry,
        activationCode: createResp?.activationCode?.code || null,
        activationExpires: createResp?.activationCode?.expires || null,
        groups: (createResp?.memberOf || []).map(g => g?.name),
        permissionSets: (createResp?.permissionSets || []).map(p => p?.name)
      };

      return sendJson(res, 200, {
        created: true,
        raw: createResp,
        summary,
        appliedPolicy: policy || null
      });
    } catch (e) {
      return sendJson(res, 500, { error: e.message || 'create failed' });
    }
  }

  // ===== MODIFY existing OA account =====
  if (req.url === '/v1/oa/users/modify' && req.method === 'POST') {
    try {
      const modReq = await readJsonBody(req);

      let idMod;
      try {
        idMod = await resolveAccountIdOrThrow({
          openathensId: modReq.openathens_id,
          username: modReq.username,
          email: modReq.email
        });
      } catch (e) {
        // If OA says "not found", return 404 instead of 500
        if (e && e.code === 'OA_NOT_FOUND') {
          return sendJson(res, 404, {
            error: e.message || 'account not found',
            code: 'OA_NOT_FOUND'
          });
        }
        // Propagate other errors to outer catch
        throw e;
      }

      const modPayload = {};

      if (typeof modReq.status === 'string') {
        const s = modReq.status.toLowerCase();
        if (['active','suspended','pending'].includes(s)) modPayload.status = s;
      }
      if (modReq.expires) modPayload.expiryDate = String(modReq.expires).trim();

      const modAttrs = {};
      if (modReq.first_name) modAttrs.forenames = String(modReq.first_name).trim();
      if (modReq.last_name)  modAttrs.surname   = String(modReq.last_name).trim();
      if (modReq.email) {
        const e = String(modReq.email).trim();
        modAttrs.emailAddress = e;
        modAttrs.uniqueEmailAddress = e;
      }
      if (Object.keys(modAttrs).length) modPayload.attributes = modAttrs;

      // Alma class → policy
      const derived = derivePolicy({
        alma_group_key:  modReq.alma_group_key?.trim(),
        alma_group_code: modReq.alma_group_code != null ? String(modReq.alma_group_code).trim() : ''
      });

      if (Array.isArray(modReq.groups) && modReq.groups.length) {
        modPayload.groups = modReq.groups;
      } else if (derived?.groups) {
        modPayload.groups = derived.groups;
      }

      if (Array.isArray(modReq.permissionSets) && modReq.permissionSets.length) {
        modPayload.permissionSets = modReq.permissionSets;
      } else if (derived?.permissionSets) {
        modPayload.permissionSets = derived.permissionSets;
      }

      const modUrl = `${OA_BASE_URL}/v1/${OA_TENANT}/account/${encodeURIComponent(idMod)}/modify`;
      const { status: modStatus, body: modResp } = await httpPostJsonWithKey(
        modUrl,
        OA_API_KEY,
        modPayload,
        'application/vnd.eduserv.iam.admin.accountRequest-v1+json'
      );

      if (modStatus < 200 || modStatus >= 300) {
        const code = modResp?.code || null;
        const message = modResp?.message || 'OA modify failed';
        return sendJson(res, modStatus, {
          error: 'OA modify failed',
          code,
          message,
          status: modStatus
        });
      }

      return sendJson(res, 200, {
        modified: true,
        id: idMod,
        raw: modResp,
        appliedPolicy: derived || null
      });

    } catch (e) {
      return sendJson(res, 500, { error: e.message || 'modify failed' });
    }
  }

  // ===== RESEND ACTIVATION (set status:pending and send email) =====
  if (req.url === '/v1/oa/users/resend-activation' && req.method === 'POST') {
    try {
      const raReq = await readJsonBody(req);

      let idRA;
      try {
        idRA = await resolveAccountIdOrThrow({
          openathensId: raReq.openathens_id,
          username: raReq.username,
          email: raReq.email
        });
      } catch (e) {
        if (e && e.code === 'OA_NOT_FOUND') {
          return sendJson(res, 404, {
            error: e.message || 'account not found',
            code: 'OA_NOT_FOUND'
          });
        }
        throw e;
      }

      const raPayload = { status: 'pending' };
      const raUrl = `${OA_BASE_URL}/v1/${OA_TENANT}/account/${encodeURIComponent(idRA)}/modify?sendEmail=true`;

      const { status: raStatus, body: raResp } = await httpPostJsonWithKey(
        raUrl,
        OA_API_KEY,
        raPayload,
        'application/vnd.eduserv.iam.admin.accountRequest-v1+json'
      );

      if (raStatus < 200 || raStatus >= 300) {
        const code = raResp?.code || null;
        const message = raResp?.message || 'OA resend activation failed';
        return sendJson(res, raStatus, {
          error: 'OA resend activation failed',
          code,
          message,
          status: raStatus
        });
      }

      return sendJson(res, 200, { resent: true, id: idRA, raw: raResp });

    } catch (e) {
      return sendJson(res, 500, { error: e.message || 'resend activation failed' });
    }
  }

  // Default 404
  res.statusCode = 404;
  res.end('Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`oa-proxy listening on 127.0.0.1:${PORT}`);
});
