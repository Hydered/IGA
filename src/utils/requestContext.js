const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();

const SYSTEM_CONTEXT = {
  ip: '127.0.0.1',
  userAgent: 'system',
};

function run(context, callback) {
  return storage.run(context, callback);
}

function getRequestContext() {
  return storage.getStore() || SYSTEM_CONTEXT;
}

function clientMetaFromRequest(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    (typeof forwarded === 'string' && forwarded.split(',')[0].trim()) ||
    req.ip ||
    req.socket?.remoteAddress ||
    'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  return { ip: String(ip), userAgent: String(userAgent) };
}

module.exports = {
  run,
  getRequestContext,
  clientMetaFromRequest,
  SYSTEM_CONTEXT,
};
