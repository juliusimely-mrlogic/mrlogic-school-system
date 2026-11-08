const db = require('./database');

function addColumnIfMissing(table, column, definition) {
  const cols = db.all(`PRAGMA table_info(${table})`);
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

const ROLES = [
  'SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACADEMIC_MASTER', 'ACADEMIC_ASSISTANT',
  'HEAD_TEACHER', 'SCHOOL_MANAGER', 'COUNCIL_ACADEMIC_OFFICER',
  'COUNCIL_EDUCATION_OFFICER', 'TEACHER'
];

function migrateUserRoles() {
  const row = db.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`);
  if (!row || row.sql.includes('ACADEMIC_ASSISTANT')) return;

  const roleList = ROLES.map(r => `'${r}'`).join(', ');
  db.exec('PRAGMA foreign_keys = OFF;');
  try {
    db.exec('BEGIN TRANSACTION;');
    db.exec(`
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        school_id INTEGER,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL UNIQUE,
        phone TEXT,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN (${roleList})),
        is_active INTEGER NOT NULL DEFAULT 1,
        last_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        council TEXT,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
      );
      INSERT INTO users_new (id, school_id, full_name, email, username, phone,
        password_hash, salt, role, is_active, last_login, created_at)
      SELECT id, school_id, full_name, email, username, phone,
        password_hash, salt, role, is_active, last_login, created_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
      CREATE INDEX IF NOT EXISTS idx_users_school ON users(school_id);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);
    db.exec('COMMIT;');
  } catch (err) {
    try { db.exec('ROLLBACK;'); } catch (e) {}
    throw err;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
}

function applyPhase1() {
  addColumnIfMissing('schools', 'ward', 'TEXT');
  addColumnIfMissing('schools', 'owner_type', "TEXT DEFAULT 'GOVERNMENT'");
  addColumnIfMissing('schools', 'school_levels', "TEXT DEFAULT 'O_LEVEL'");
  addColumnIfMissing('schools', 'exam_number', 'TEXT');
  addColumnIfMissing('schools', 'head_teacher_name', 'TEXT');
  addColumnIfMissing('schools', 'languages', `TEXT DEFAULT '["sw"]'`);
  addColumnIfMissing('schools', 'stamp_path', 'TEXT');
  migrateUserRoles();
  console.log('[DB] Phase 1 school fields and roles ready.');
}

module.exports = { applyPhase1 };