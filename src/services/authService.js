const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const userRepository = require('../repositories/userRepository');
const logger = require('./loggerService');

function login(loginName, password) {
  const user = userRepository.findByLogin(loginName);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    logger.warn('auth', `Неудачная попытка входа: ${loginName}`);
    return { success: false, error: 'Неверный логин или пароль' };
  }

  const token = jwt.sign(
    { id: user.id, login: user.login, role: user.role, full_name: user.full_name, can_view_reports: !!user.can_view_reports },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  logger.info('auth', `Вход пользователя: ${user.login}`, user.id);

  return {
    success: true,
    token,
    user: {
      id: user.id,
      login: user.login,
      full_name: user.full_name,
      role: user.role,
      department_id: user.department_id,
      department_name: user.department_name,
      can_view_reports: !!user.can_view_reports,
      email: user.email,
    },
  };
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

module.exports = { login, verifyToken };
