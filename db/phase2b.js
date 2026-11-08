const db = require('./database');

function addColumnIfMissing(table, column, definition) {
  const cols = db.all(`PRAGMA table_info(${table})`);
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

const OLEVEL_CATEGORIES = {
  SCIENCE: ['PHY', 'CHEM', 'BIO', 'B/MATH', 'MATH', 'AGRI', 'ICT', 'COMP'],
  ARTS: ['GEO', 'HIST', 'CIV', 'KISW', 'ENG', 'HTM', 'FAK', 'THEA', 'FIA'],
  BUSINESS: ['COMM', 'BK', 'BKPG', 'ACC', 'ACCT', 'BUS']
};

function applyPhase2b() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS combinations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      UNIQUE (school_id, code)
    );
  `);

  addColumnIfMissing('subjects', 'level_type', "TEXT NOT NULL DEFAULT 'O_LEVEL'");
  addColumnIfMissing('subjects', 'category', 'TEXT');
  addColumnIfMissing('subjects', 'a_level_role', 'TEXT');
  addColumnIfMissing('students', 'combination_id',
    'INTEGER REFERENCES combinations(id) ON DELETE SET NULL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS combination_subjects (
      combination_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      PRIMARY KEY (combination_id, subject_id),
      FOREIGN KEY (combination_id) REFERENCES combinations(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS student_subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      UNIQUE (student_id, subject_id)
    );
  `);

  for (const [category, codes] of Object.entries(OLEVEL_CATEGORIES)) {
    const marks = codes.map(() => '?').join(',');
    db.run(
      `UPDATE subjects SET category = ?
       WHERE category IS NULL AND level_type = 'O_LEVEL' AND UPPER(code) IN (${marks})`,
      [category, ...codes]
    );
  }

  const { ensureLevelSetup } = require('../services/levelService');
  for (const s of db.all('SELECT id, school_levels FROM schools')) {
    ensureLevelSetup(s.id, s.school_levels);
  }
  console.log('[DB] Phase 2b subjects and combinations ready.');
}

module.exports = { applyPhase2b };