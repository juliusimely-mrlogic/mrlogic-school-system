const db = require('./database');

function migrateClassesTable() {
  const row = db.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='classes'`);
  if (!row || row.sql.includes('level_type')) return;

  db.exec('PRAGMA foreign_keys = OFF;');
  try {
    db.exec('BEGIN TRANSACTION;');
    db.exec(`
      CREATE TABLE classes_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        school_id INTEGER NOT NULL,
        form_level INTEGER NOT NULL CHECK(form_level BETWEEN 1 AND 7),
        name TEXT NOT NULL,
        numeric_order INTEGER NOT NULL,
        level_type TEXT NOT NULL DEFAULT 'O_LEVEL'
          CHECK(level_type IN ('PRIMARY', 'O_LEVEL', 'A_LEVEL')),
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        UNIQUE (school_id, name)
      );
      INSERT INTO classes_new (id, school_id, form_level, name, numeric_order, level_type)
      SELECT id, school_id, form_level, name, numeric_order,
             CASE WHEN form_level >= 5 THEN 'A_LEVEL' ELSE 'O_LEVEL' END
      FROM classes;
      DROP TABLE classes;
      ALTER TABLE classes_new RENAME TO classes;
    `);
    db.exec('COMMIT;');
  } catch (err) {
    try { db.exec('ROLLBACK;'); } catch (e) {}
    throw err;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }

  const problems = db.all('PRAGMA foreign_key_check');
  if (problems.length > 0) {
    console.warn('[DB] foreign_key_check found', problems.length, 'issue(s) after classes migration');
  }
}

function ensureClassesForExistingSchools() {
  const { ensureLevelClasses } = require('../services/levelService');
  for (const s of db.all('SELECT id, school_levels FROM schools')) {
    ensureLevelClasses(s.id, s.school_levels);
  }
}

function applyPhase2() {
  migrateClassesTable();
  ensureClassesForExistingSchools();
  console.log('[DB] Phase 2 level classes ready.');
}

module.exports = { applyPhase2 };