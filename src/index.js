const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const config = require('./config');
config.assertSecurityConfig();

const { initDatabase } = require('./db/init');
const fileService = require('./services/fileService');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./services/loggerService');

const authRoutes = require('./routes/auth');
const catalogRoutes = require('./routes/catalog');
const requestRoutes = require('./routes/requests');
const fileRoutes = require('./routes/files');
const reportRoutes = require('./routes/reports');

const app = express();

const corsOptions = config.corsOrigin
  ? {
      origin: config.corsOrigin.split(',').map((o) => o.trim()),
      credentials: true,
    }
  : {
      origin: [
        `http://localhost:${config.port}`,
        `http://127.0.0.1:${config.port}`,
      ],
    };

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

app.use(
  express.static(path.join(__dirname, '../public'), {
    setHeaders(res, filePath) {
      if (filePath.endsWith('.js') || filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/reports', reportRoutes);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'IGA Access Management',
  });
});

app.use(errorHandler);

async function startServer() {
  try {
    console.log('Запуск приложения...');
    console.log('PORT =', config.port);

    await initDatabase();

    console.log('База данных готова');

    fileService.ensureUploadsDir();

    console.log('Папка uploads проверена');

    app.listen(config.port, () => {
      console.log(`Сервер запущен: http://localhost:${config.port}`);

      logger.info(
        'server',
        `Сервер запущен на http://localhost:${config.port}`
      );
    });
  } catch (err) {
    console.error('Ошибка запуска сервера:');
    console.error(err);
  }
}

startServer();

module.exports = app;