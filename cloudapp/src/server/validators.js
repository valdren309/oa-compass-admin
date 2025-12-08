// validators.js
'use strict';

function isValidEmail(email) {
  return typeof email === 'string' && email.includes('@');
}

/**
 * Very simple YYYY-MM-DD check (no calendar logic).
 */
function isValidDateYYYYMMDD(value) {
  if (typeof value !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Validate + normalize the create payload fields that OA needs.
 * Matches existing behavior:
 * - email must be non-empty and contain '@'
 * - first_name, last_name, expires required
 * - status defaults to 'pending', but active→pending if no password
 */
function validateCreatePayload(body) {
  const email  = (body.email || '').trim();
  const first  = (body.first_name || '').trim();
  const last   = (body.last_name || '').trim();
  const expiry = (body.expires || '').trim(); // expected YYYY-MM-DD
  const password = body.password ? String(body.password) : undefined;

  let status = body.status ? String(body.status).toLowerCase() : 'pending';
  if (status === 'active' && !password) {
    status = 'pending';
  }

  const alma_group_key =
    typeof body.alma_group_key === 'string'
      ? body.alma_group_key.trim()
      : '';

  const alma_group_code =
    body.alma_group_code != null
      ? String(body.alma_group_code).trim()
      : '';

  const invalid = {};

  if (!isValidEmail(email)) {
    invalid.email = 'invalid';
  }

  if (!first) {
    invalid.first_name = 'required';
  }

  if (!last) {
    invalid.last_name = 'required';
  }

  if (!expiry) {
    invalid.expires = 'required';
  }

  return {
    invalid,
    normalized: {
      email,
      first,
      last,
      expiry,
      password,
      status,
      alma_group_key,
      alma_group_code,
    },
  };
}

module.exports = {
  isValidEmail,
  isValidDateYYYYMMDD,
  validateCreatePayload,
};
