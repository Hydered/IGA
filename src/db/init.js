const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const { getDb } = require('./database');
const config = require('../config');

function initDatabase() {
  try {
    const db = getDb();

    const schema = fs.readFileSync(
      path.join(__dirname, 'schema.sql'),
      'utf8'
    );

    let deptCount = 0;

    try {
      deptCount = db
        .prepare('SELECT COUNT(*) as c FROM departments')
        .get().c;
    } catch (e) {
      // Таблицы еще нет
      deptCount = 0;
    }

    if (deptCount === 0) {
      db.exec(schema);
      seedData(db);
    } else {
      resetDatabase(db);
      db.exec(schema);
      seedData(db);
    }

    console.log(
      'База данных инициализирована заново:',
      config.dbPath
    );

    return true;
  } catch (err) {
    console.error('Ошибка initDatabase:', err);

    return false;
  }
}

function resetDatabase(db) {
  db.exec('PRAGMA foreign_keys = OFF');

  const tables = [
    'request_approvers',
    'comments',
    'attachments',
    'request_history',
    'requests',
    'resources',
    'access_types',
    'users',
    'departments',
  ];

  tables.forEach((table) => {
    db.exec(`DROP TABLE IF EXISTS ${table}`);
  });

  db.exec('PRAGMA foreign_keys = ON');
}

function seedData(db) {
  // === ОТДЕЛЫ ===

  const insertDept = db.prepare(
    'INSERT INTO departments (name, code) VALUES (?, ?)'
  );

  const depts = [
    ['ИТ-служба', 'IT'],
    ['Разработка', 'DEV'],
  ];

  depts.forEach((d) => insertDept.run(...d));

  // === РЕСУРСЫ ===

  const insertResource = db.prepare(
    `
    INSERT INTO resources
    (name, type, description, owner_department_id)
    VALUES (?, ?, ?, ?)
  `
  );

  const resources = [
    ['Файловый сервер', 'папка', 'Общие файлы ИТ-отдела', 1],
    ['Основная БД', 'база данных', 'Основная БД для разработки', 2],
  ];

  resources.forEach((r) => insertResource.run(...r));

  // === ТИПЫ ДОСТУПА ===

  const insertAccess = db.prepare(
    'INSERT INTO access_types (name, description) VALUES (?, ?)'
  );

  [
    ['чтение', 'Только просмотр'],
    ['запись', 'Чтение и создание файлов'],
  ].forEach((a) => insertAccess.run(...a));

  // === ПОЛЬЗОВАТЕЛИ ===

  const hash = bcrypt.hashSync('password123', 10);

  const insertUser = db.prepare(
    `
    INSERT INTO users
    (
      login,
      password_hash,
      full_name,
      department_id,
      role,
      email,
      can_view_reports
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `
  );

 const users = [
  [
    'applicant',
    hash,
    'Заявитель',
    2,
    'applicant',
    'applicant@company.local',
    0,
  ],

  [
    'approver',
    hash,
    'Согласующий',
    1,
    'approver',
    'approver@company.local',
    1,
  ],

  [
    'executor',
    hash,
    'Исполнитель',
    1,
    'executor',
    'executor@company.local',
    1,
  ],

  [
    'admin',
    hash,
    'Администратор',
    1,
    'admin',
    'admin@company.local',
    1,
  ],
];

  users.forEach((u) => insertUser.run(...u));

  console.log('Тестовые данные загружены');
}

if (require.main === module) {
  initDatabase();
}

module.exports = {
  initDatabase,
  seedData,
};