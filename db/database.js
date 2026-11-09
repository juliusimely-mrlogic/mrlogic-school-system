const { Pool } = require('pg');
require('dotenv').config();

// Tunatumia DATABASE_URL iliyopo kwenye faili la .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false
});

// Kazi ya kutengeneza tables (PostgreSQL Syntax)
async function createTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schools (
        id SERIAL PRIMARY KEY, code VARCHAR(50) UNIQUE, name VARCHAR(255), region VARCHAR(100), district VARCHAR(100), 
        ward VARCHAR(100), exam_center_no VARCHAR(100), headmaster_name VARCHAR(255), ownership VARCHAR(50), language VARCHAR(50), 
        levels TEXT, is_active INTEGER DEFAULT 1, subscription_expires TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, 
        full_name VARCHAR(255), email VARCHAR(255), username VARCHAR(100) UNIQUE, 
        password_hash TEXT, salt TEXT, role VARCHAR(50), is_password_changed INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS classes (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, form_level INTEGER, name VARCHAR(100), numeric_order INTEGER, level_type VARCHAR(50));
      CREATE TABLE IF NOT EXISTS streams (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE, name VARCHAR(100));
      CREATE TABLE IF NOT EXISTS subjects (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, code VARCHAR(50), name VARCHAR(255), is_core INTEGER DEFAULT 1, is_active INTEGER DEFAULT 1, level_type VARCHAR(50), category VARCHAR(50), a_level_role VARCHAR(50));
      CREATE TABLE IF NOT EXISTS combinations (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, code VARCHAR(50), name VARCHAR(255), is_active INTEGER DEFAULT 1);
      CREATE TABLE IF NOT EXISTS combination_subjects (combination_id INTEGER REFERENCES combinations(id) ON DELETE CASCADE, subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS students (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL, stream_id INTEGER, full_name VARCHAR(255), gender VARCHAR(10), admission_number VARCHAR(100), parent_phone VARCHAR(20));
      CREATE TABLE IF NOT EXISTS attendance (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE, student_id INTEGER REFERENCES students(id) ON DELETE CASCADE, date VARCHAR(50), status VARCHAR(20));
      CREATE TABLE IF NOT EXISTS exams (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE, name VARCHAR(255), term VARCHAR(50), year INTEGER, max_marks INTEGER DEFAULT 100, is_published INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS exam_results (id SERIAL PRIMARY KEY, exam_id INTEGER REFERENCES exams(id) ON DELETE CASCADE, student_id INTEGER REFERENCES students(id) ON DELETE CASCADE, subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE, marks REAL);
      CREATE TABLE IF NOT EXISTS fee_structure (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE, term VARCHAR(50), year INTEGER, amount REAL);
      CREATE TABLE IF NOT EXISTS fees (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, student_id INTEGER REFERENCES students(id) ON DELETE CASCADE, amount REAL, term VARCHAR(50), year INTEGER, date_paid TIMESTAMP);
      CREATE TABLE IF NOT EXISTS teachers (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, full_name VARCHAR(255), phone VARCHAR(20), gender VARCHAR(10));
      CREATE TABLE IF NOT EXISTS teacher_assignments (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE, class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE, subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, title VARCHAR(255), message TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS system_payments (id SERIAL PRIMARY KEY, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, amount REAL, date_paid TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    `);
    console.log("✅ Majedwali yote ya PostgreSQL yametengenezwa kikamilifu.");
  } catch (err) {
    console.error("❌ Kosa la kutengeneza majedwali:", err.message);
  }
}

createTables();

// Tunatengeneza 'Wrapper' ili code zako za zamani ziendelee kufanya kazi, lakini kwa PostgreSQL
// Kumbuka: Katika PostgreSQL, majibu yanachukua muda (Asynchronous). Tumerahisisha kwa kuweka hivi:
module.exports = {
  query: (text, params) => pool.query(text, params),
  
  // Kazi hizi zinarudisha 'Promises' (Lazima uweke 'await' kwenye API zako)
  run: async (sql, params = []) => {
    try { 
      // Kubadilisha '?' kuwa '$1, $2...' kwa ajili ya PostgreSQL
      let formattedSql = sql;
      let count = 1;
      formattedSql = formattedSql.replace(/\?/g, () => `$${count++}`);
      
      const res = await pool.query(formattedSql, params); 
      return { changes: res.rowCount, lastInsertRowid: res.rows[0]?.id }; 
    } catch (e) { 
      console.error("DB Run Error:", e.message); return { changes: 0 }; 
    }
  },
  get: async (sql, params = []) => {
    try { 
      let formattedSql = sql;
      let count = 1;
      formattedSql = formattedSql.replace(/\?/g, () => `$${count++}`);
      const res = await pool.query(formattedSql, params); 
      return res.rows[0]; 
    } catch (e) { 
      console.error("DB Get Error:", e.message); return undefined; 
    }
  },
  all: async (sql, params = []) => {
    try { 
      let formattedSql = sql;
      let count = 1;
      formattedSql = formattedSql.replace(/\?/g, () => `$${count++}`);
      const res = await pool.query(formattedSql, params); 
      return res.rows; 
    } catch (e) { 
      console.error("DB All Error:", e.message); return []; 
    }
  }
};