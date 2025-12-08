// server.js
'use strict';

const http = require('http');
const { PORT, ALLOWED_ORIGINS } = require('./config');
const { setCors } = require('./cors');
const {
  sendJson,
  handleHealth,
  handleVerify,
  handleGetAccount,
  handleCreate,
  handleModify,
  handleResendActivation,
} = require('./routes/users');

const server = http.createServer(async (req, res) => {
  setCors(req, res, ALLOWED_ORIGINS);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.url === '/health' && req.method === 'GET') {
    return handleHealth(req, res);
  }

  if (req.url === '/v1/oa/users/verify' && req.method === 'POST') {
    return handleVerify(req, res);
  }

  if (req.url === '/v1/oa/users/get' && req.method === 'POST') {
    return handleGetAccount(req, res);
  }

  if (req.url === '/v1/oa/users/create' && req.method === 'POST') {
    return handleCreate(req, res);
  }

  if (req.url === '/v1/oa/users/modify' && req.method === 'POST') {
    return handleModify(req, res);
  }

  if (req.url === '/v1/oa/users/resend-activation' && req.method === 'POST') {
    return handleResendActivation(req, res);
  }

  // Default 404
  res.statusCode = 404;
  res.end('Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`oa-proxy listening on 127.0.0.1:${PORT}`);
});
