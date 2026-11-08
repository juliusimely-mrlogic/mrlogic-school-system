const Database = require('better-sqlite3');
const config = require('../config');
const path = require('path');

const dbPath = path.resolve(__dirname, '..', config.dbPath || './db/mrlogic.db');
const dbInstance = new Database(dbPath);

dbInstance.pragma('foreign_keys = ON');

dbInstance.exec(`
  CREATE TABLE IF NOT EXISTS schools (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE, name TEXT, region TEXT, district TEXT);
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, school_id INTEGER, full_name TEXT, email TEXT, username TEXT UNIQUE, password_hash TEXT, salt TEXT, role TEXT, FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE);
  
  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, school_id INTEGER, form_level INTEGER, name TEXT, numeric_order INTEGER, level_type TEXT, 
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS streams (
    id INTEGER PRIMARY KEY AUTOINCREMENT, school_id INTEGER, class_id INTEGER, name TEXT,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT, school_id INTEGER, code TEXT, name TEXT, is_core INTEGER DEFAULT 1, is_active INTEGER DEFAULT 1, level_type TEXT, category TEXT, a_level_role TEXT,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS combinations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, school_id INTEGER, code TEXT, name TEXT, is_active INTEGER DEFAULT 1,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS combination_subjects (
    combination_id INTEGER, subject_id INTEGER, 
    FOREIGN KEY (combination_id) REFERENCES combinations(id) ON DELETE CASCADE, 
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY AUTOINCREMENT, school_id INTEGER, class_id INTEGER, full_name TEXT, gender TEXT, admission_number TEXT, parent_phone TEXT, FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE, FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL);
  CREATE TABLE IF NOT EXISTS attendance (id INTEGER PRIMARY KEY AUTOINCREMENT, school_id INTEGER, class_id INTEGER, student_id INTEGER, date TEXT, status TEXT, FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE, FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE, FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE);
  CREATE TABLE IF NOT EXISTS exams (id INTEGER PRIMARY KEY AUTOINCREMENT, school_id INTEGER, class_id INTEGER, name TEXT, term TEXT, year INTEGER, FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE, FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE);
  CREATE TABLE IF NOT EXISTS exam_results (id INTEGER PRIMARY KEY AUTOINCREMENT, exam_id INTEGER, student_id INTEGER, subject_id INTEGER, marks REAL, FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE, FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE, FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE);
  CREATE TABLE IF NOT EXISTS fees (id INTEGER PRIMARY KEY AUTOINCREMENT, school_id INTEGER, student_id INTEGER, amount REAL, term TEXT, year INTEGER, date_paid TEXT, FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE, FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE);
  CREATE TABLE IF NOT EXISTS teachers (id INTEGER PRIMARY KEY AUTOINCREMENT, school_id INTEGER, full_name TEXT, phone TEXT, gender TEXT, FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE);
  CREATE TABLE IF NOT EXISTS teacher_assignments (id INTEGER PRIMARY KEY AUTOINCREMENT, school_id INTEGER, teacher_id INTEGER, class_id INTEGER, subject_id INTEGER, FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE, FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE, FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE, FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE);
  CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, school_id INTEGER, title TEXT, message TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE);
`);

module.exports = {
  run: (sql, params = []) => { try { return dbInstance.prepare(sql).run(params); } catch (e) { console.error("DB Run Error:", e.message); return { changes: 0, lastInsertRowid: null }; } },
  get: (sql, params = []) => { try { return dbInstance.prepare(sql).get(params); } catch (e) { console.error("DB Get Error:", e.message); return undefined; } },
  all: (sql, params = []) => { try { return dbInstance.prepare(sql).all(params); } catch (e) { console.error("DB All Error:", e.message); return []; } },
  exec: (sql) => dbInstance.exec(sql)
};