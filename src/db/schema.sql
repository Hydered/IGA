-- Пользователи
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  department_id INTEGER,
  role TEXT NOT NULL DEFAULT 'applicant',
  email TEXT,
  can_view_reports INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Подразделения
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  code TEXT
);

-- Ресурсы (папки, сервисы, БД, приложения)
CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  owner_department_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (owner_department_id) REFERENCES departments(id)
);

-- Типы доступа
CREATE TABLE IF NOT EXISTS access_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

-- Заявки
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  applicant_id INTEGER NOT NULL,
  department_id INTEGER NOT NULL,
  resource_id INTEGER NOT NULL,
  access_type_id INTEGER NOT NULL,
  basis TEXT,
  justification TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'средний',
  valid_from TEXT,
  valid_until TEXT,
  status TEXT NOT NULL DEFAULT 'новая',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (applicant_id) REFERENCES users(id),
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (resource_id) REFERENCES resources(id),
  FOREIGN KEY (access_type_id) REFERENCES access_types(id)
);

-- Маршрут согласования
CREATE TABLE IF NOT EXISTS request_approvers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  approver_id INTEGER NOT NULL,
  step_order INTEGER NOT NULL DEFAULT 1,
  decision TEXT,
  decided_at TEXT,
  comment TEXT,
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  FOREIGN KEY (approver_id) REFERENCES users(id),
  UNIQUE(request_id, approver_id)
);

-- Комментарии
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Вложения
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- История изменений
CREATE TABLE IF NOT EXISTS request_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  user_id INTEGER,
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Системный лог
CREATE TABLE IF NOT EXISTS system_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,
  module TEXT NOT NULL,
  message TEXT NOT NULL,
  user_id INTEGER,
  meta TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_applicant ON requests(applicant_id);
CREATE INDEX IF NOT EXISTS idx_requests_number ON requests(number);
CREATE INDEX IF NOT EXISTS idx_history_request ON request_history(request_id);
CREATE INDEX IF NOT EXISTS idx_comments_request ON comments(request_id);
