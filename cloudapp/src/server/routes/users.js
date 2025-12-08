// routes/users.js
'use strict';

const {
  OA_BASE_URL,
  OA_TENANT,
  OA_API_KEY,
  OA_CREATE_URL,
  GROUP_MAP,
  CODE_TO_KEY,
} = require('../config');

const {
  normalizeUsername,
  queryAccount,
  resolveAccountIdOrThrow,
  httpPostJsonWithKey,
} = require('../oa-client');

const {
  validateCreatePayload,
} = require('../validators');

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 200 * 1024) {
        return reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Alma group → OA policy mapping
function derivePolicy({ alma_group_key, alma_group_code }) {
  if (alma_group_key && GROUP_MAP[alma_group_key]) {
    return GROUP_MAP[alma_group_key];
  }
  if (alma_group_code && CODE_TO_KEY[alma_group_code]) {
    const key = CODE_TO_KEY[alma_group_code];
    if (GROUP_MAP[key]) {
      return GROUP_MAP[key];
    }
  }
  return null;
}

/**
 * Validate required env vars for a handler.
 * Each item is { value, message }.
 * Returns true if OK, false if it sends a 500.
 */
function checkRequiredEnv(res, checks) {
  for (const c of checks) {
    if (!c.value) {
      sendJson(res, 500, { error: c.message });
      return false;
    }
  }
  return true;
}

/**
 * Central OA error sender for "query"/"create"/"modify"/"resend" failures.
 */
function sendOAError(res, status, body, label) {
  const code = body && typeof body === 'object' ? (body.code || null) : null;
  const message =
    body && typeof body === 'object' && body.message
      ? body.message
      : label;

  return sendJson(res, status, {
    error: label,
    code,
    message,
    status,
  });
}

/* ===== route handlers ===== */

function handleHealth(_req, res) {
  return sendJson(res, 200, {
    ok: true,
    service: 'oa-proxy',
    time: new Date().toISOString(),
  });
}

// /v1/oa/users/verify (POST)
async function handleVerify(req, res) {
  try {
    if (
      !checkRequiredEnv(res, [
        { value: OA_BASE_URL, message: 'OA_BASE_URL not set' },
        { value: OA_TENANT,   message: 'OA_TENANT not set' },
        { value: OA_API_KEY,  message: 'OA_API_KEY not set' },
      ])
    ) return;

    const bodyIn = await readJsonBody(req);
    const vUsername = bodyIn?.username;
    const vEmail    = bodyIn?.email;

    if (!vUsername && !vEmail) {
      return sendJson(res, 400, { error: 'username or email required' });
    }

    const { status: qStatus, body: qBody } = await queryAccount({
      username: vUsername,
      email: vEmail,
    });

    if (qStatus === 404) {
      return sendJson(res, 200, {
        found: false,
        normalizedUsername: normalizeUsername(vUsername) || null,
        raw: { status: 404 },
      });
    }

    if (qStatus < 200 || qStatus >= 300) {
      return sendOAError(res, qStatus, qBody, 'OA query failed');
    }

    const total =
      (qBody && (qBody.total ?? qBody.count ?? (Array.isArray(qBody) ? qBody.length : 0))) || 0;

    return sendJson(res, 200, {
      found: total > 0,
      normalizedUsername: normalizeUsername(vUsername) || null,
      raw: qBody,
    });
  } catch (e) {
    return sendJson(res, 500, { error: e.message || 'verify failed' });
  }
}

// /v1/oa/users/get (POST)
async function handleGetAccount(req, res) {
  try {
    if (
      !checkRequiredEnv(res, [
        { value: OA_BASE_URL, message: 'OA_BASE_URL not set' },
        { value: OA_TENANT,   message: 'OA_TENANT not set' },
        { value: OA_API_KEY,  message: 'OA_API_KEY not set' },
      ])
    ) return;

    const bodyGet = await readJsonBody(req);
    const gUsername = bodyGet?.username;
    const gEmail    = bodyGet?.email;

    if (!gUsername && !gEmail) {
      return sendJson(res, 400, { error: 'username or email required' });
    }

    const { status: getStatus, body: getResp } = await queryAccount({
      username: gUsername,
      email: gEmail,
    });

    if (getStatus === 404) {
      return sendJson(res, 404, {
        error: 'not found',
        normalizedUsername: normalizeUsername(gUsername) || null,
      });
    }

    if (getStatus < 200 || getStatus >= 300) {
      return sendOAError(res, getStatus, getResp, 'OA query failed');
    }

    let account = null;
    if (Array.isArray(getResp) && getResp.length) account = getResp[0];
    else if (getResp?.results?.length)           account = getResp.results[0];
    else if (getResp && typeof getResp === 'object') account = getResp;

    if (!account) {
      return sendJson(res, 404, {
        error: 'not found',
        normalizedUsername: normalizeUsername(gUsername) || null,
      });
    }

    return sendJson(res, 200, {
      account,
      normalizedUsername: normalizeUsername(gUsername) || null,
    });
  } catch (e) {
    return sendJson(res, 500, { error: e.message || 'get failed' });
  }
}

// /v1/oa/users/create (POST)
async function handleCreate(req, res) {
  try {
    if (
      !checkRequiredEnv(res, [
        { value: OA_API_KEY,   message: 'OA_API_KEY not set' },
        { value: OA_CREATE_URL, message: 'OA_CREATE_URL not set' },
      ])
    ) return;

    const bodyIn = await readJsonBody(req);
    const { invalid, normalized } = validateCreatePayload(bodyIn);

    if (Object.keys(invalid).length) {
      return sendJson(res, 400, {
        error: 'invalid input',
        invalid,
      });
    }

    const {
      email: cEmail,
      first: cFirst,
      last: cLast,
      expiry: cExpiry,
      password: cPassword,
      status: cStatus,
      alma_group_key: cKey,
      alma_group_code: cCode,
    } = normalized;

    // Build OA payload WITHOUT username so OA can generate it
    const oaBody = {
      status: cStatus,
      expiryDate: cExpiry,
      attributes: {
        forenames: cFirst,
        surname:   cLast,
        emailAddress: cEmail,
        uniqueEmailAddress: cEmail,
      },
    };

    if (cPassword) {
      oaBody.password = cPassword;
    }

    // Apply mapping (code → key → policy)
    const policy = derivePolicy({
      alma_group_key: cKey,
      alma_group_code: cCode,
    });

    if (policy && !Array.isArray(bodyIn.groups) && !Array.isArray(bodyIn.permissionSets)) {
      oaBody.groups = policy.groups;
      oaBody.permissionSets = policy.permissionSets;
    }

    // Explicit overrides from caller (if provided)
    if (Array.isArray(bodyIn.groups) && bodyIn.groups.length) {
      oaBody.groups = bodyIn.groups;
    }
    if (Array.isArray(bodyIn.permissionSets) && bodyIn.permissionSets.length) {
      oaBody.permissionSets = bodyIn.permissionSets;
    }

    const { status: createStatus, body: createResp } = await httpPostJsonWithKey(
      OA_CREATE_URL,
      OA_API_KEY,
      oaBody,
      'application/vnd.eduserv.iam.admin.accountRequest-v1+json'
    );

    const respText =
      typeof createResp === 'string'
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
        reason: 'OpenAthens account already exists',
      });
    }

    if (createStatus < 200 || createStatus >= 300) {
      return sendOAError(res, createStatus, createResp, 'OA create failed');
    }

    const summary = {
      id: createResp?.id,
      username: createResp?.username,
      status: createResp?.status,
      expiry:  createResp?.expiry,
      activationCode: createResp?.activationCode?.code || null,
      activationExpires: createResp?.activationCode?.expires || null,
      groups: (createResp?.memberOf || []).map(g => g?.name),
      permissionSets: (createResp?.permissionSets || []).map(p => p?.name),
    };

    return sendJson(res, 200, {
      created: true,
      raw: createResp,
      summary,
      appliedPolicy: policy || null,
    });
  } catch (e) {
    return sendJson(res, 500, { error: e.message || 'create failed' });
  }
}

// /v1/oa/users/modify (POST)
async function handleModify(req, res) {
  try {
    if (
      !checkRequiredEnv(res, [
        { value: OA_BASE_URL, message: 'OA_BASE_URL not set' },
        { value: OA_TENANT,   message: 'OA_TENANT not set' },
        { value: OA_API_KEY,  message: 'OA_API_KEY not set' },
      ])
    ) return;

    const modReq = await readJsonBody(req);

    let idMod;
    try {
      idMod = await resolveAccountIdOrThrow({
        openathensId: modReq.openathens_id,
        username: modReq.username,
        email: modReq.email,
      });
    } catch (e) {
      if (e && e.code === 'OA_NOT_FOUND') {
        return sendJson(res, 404, {
          error: e.message || 'account not found',
          code: 'OA_NOT_FOUND',
        });
      }
      throw e;
    }

    const modPayload = {};

    if (typeof modReq.status === 'string') {
      const s = modReq.status.toLowerCase();
      if (['active', 'suspended', 'pending'].includes(s)) {
        modPayload.status = s;
      }
    }

    if (modReq.expires) {
      modPayload.expiryDate = String(modReq.expires).trim();
    }

    const modAttrs = {};
    if (modReq.first_name) modAttrs.forenames = String(modReq.first_name).trim();
    if (modReq.last_name)  modAttrs.surname   = String(modReq.last_name).trim();
    if (modReq.email) {
      const e = String(modReq.email).trim();
      modAttrs.emailAddress = e;
      modAttrs.uniqueEmailAddress = e;
    }

    if (Object.keys(modAttrs).length) {
      modPayload.attributes = modAttrs;
    }

    const derived = derivePolicy({
      alma_group_key:  modReq.alma_group_key?.trim(),
      alma_group_code: modReq.alma_group_code != null ? String(modReq.alma_group_code).trim() : '',
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
      return sendOAError(res, modStatus, modResp, 'OA modify failed');
    }

    return sendJson(res, 200, {
      modified: true,
      id: idMod,
      raw: modResp,
      appliedPolicy: derived || null,
    });
  } catch (e) {
    return sendJson(res, 500, { error: e.message || 'modify failed' });
  }
}

// /v1/oa/users/resend-activation (POST)
async function handleResendActivation(req, res) {
  try {
    if (
      !checkRequiredEnv(res, [
        { value: OA_BASE_URL, message: 'OA_BASE_URL not set' },
        { value: OA_TENANT,   message: 'OA_TENANT not set' },
        { value: OA_API_KEY,  message: 'OA_API_KEY not set' },
      ])
    ) return;

    const raReq = await readJsonBody(req);

    let idRA;
    try {
      idRA = await resolveAccountIdOrThrow({
        openathensId: raReq.openathens_id,
        username: raReq.username,
        email: raReq.email,
      });
    } catch (e) {
      if (e && e.code === 'OA_NOT_FOUND') {
        return sendJson(res, 404, {
          error: e.message || 'account not found',
          code: 'OA_NOT_FOUND',
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
      return sendOAError(res, raStatus, raResp, 'OA resend activation failed');
    }

    return sendJson(res, 200, {
      resent: true,
      id: idRA,
      raw: raResp,
    });
  } catch (e) {
    return sendJson(res, 500, { error: e.message || 'resend activation failed' });
  }
}

module.exports = {
  sendJson,
  handleHealth,
  handleVerify,
  handleGetAccount,
  handleCreate,
  handleModify,
  handleResendActivation,
};
