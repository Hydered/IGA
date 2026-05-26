const { run, clientMetaFromRequest } = require('../utils/requestContext');

function requestContextMiddleware(req, res, next) {
  run(clientMetaFromRequest(req), () => next());
}

module.exports = requestContextMiddleware;
