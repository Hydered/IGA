const express = require('express');
const rateLimit = require('express-rate-limit');
const authService = require('../services/authService');
const config = require('../config');
const { authenticate } = require('../middleware/auth');
const userRepository = require('../repositories/userRepository');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: config.loginRateLimitWindowMs,
  max: config.loginRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа. Повторите позже.' },
});

router.post('/login', loginLimiter, (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) {
    return res.status(400).json({ error: 'Укажите логин и пароль' });
  }
  const result = authService.login(login, password);
  if (!result.success) return res.status(401).json({ error: result.error });
  res.json(result);
});

router.get('/me', authenticate, (req, res) => {
  const user = userRepository.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({ user });
});

module.exports = router;
