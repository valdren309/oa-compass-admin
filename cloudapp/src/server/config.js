// config.js
'use strict';

const PORT = process.env.PORT ? Number(process.env.PORT) : 8081;

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const OA_BASE_URL = process.env.OA_BASE_URL || '';
const OA_TENANT   = process.env.OA_TENANT   || '';
const OA_API_KEY  = process.env.OA_API_KEY  || '';
const OA_USERNAME_PREFIX = process.env.OA_USERNAME_PREFIX || 'iast-';
const OA_CREATE_URL      = process.env.OA_CREATE_URL      || '';

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
  '05': 'retiree',
  '52': 'foundation',
  '53': 'emeritus',
  '56': 'affiliate',
  '57': 'xmur',
  '58': 'visitscholar',
  '61': 'free_vc',
  '62': 'paid_vc',
  '63': 'spouse'
};

module.exports = {
  PORT,
  ALLOWED_ORIGINS,
  OA_BASE_URL,
  OA_TENANT,
  OA_API_KEY,
  OA_USERNAME_PREFIX,
  OA_CREATE_URL,
  GROUP_MAP,
  CODE_TO_KEY,
};
