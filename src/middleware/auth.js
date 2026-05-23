const authService = require('../services/authService');
const userRepository = require('../repositories/userRepository');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  const payload = authService.verifyToken(header.slice(7));
  if (!payload?.id) {
    return res.status(401).json({ error: 'Недействительный токен' });
  }

  const user = userRepository.findById(payload.id);
  if (!user) {
    return res.status(401).json({ error: 'Пользователь не найден' });
  }

  req.user = {
    id: user.id,
    login: user.login,
    role: user.role,
    full_name: user.full_name,
    department_id: user.department_id,
    can_view_reports: !!user.can_view_reports,
  };
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
