const authService = require('../services/authService');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  const payload = authService.verifyToken(header.slice(7));
  if (!payload) {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
  req.user = payload;
  next();
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
}

module.exports = { authenticate, requireRoles };
