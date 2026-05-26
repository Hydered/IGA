const logger = require('../services/loggerService');

function errorHandler(err, req, res, _next) {
  logger.error('api', err.message, req.user?.id, {
    stack: err.stack,
    path: req.path,
    method: req.method,
  });
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Внутренняя ошибка сервера' : err.message,
  });
}

module.exports = errorHandler;
