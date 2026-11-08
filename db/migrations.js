/**
 * MR LOGIC SCHOOL SYSTEM - Schema Migrations Runner
 */
const fs = require('node:fs');
const path = require('node:path');
const db = require('./database');
const { applyPhase1 } = require('./phase1');
const { applyPhase2 } = require('./phase2');
const { applyPhase2b } = require('./phase2b');

function ensureDefaultStreams() {
  try {
    const classes = db.all(`SELECT id, school_id, name FROM classes`);
    for (const c of classes) {
      for (const sName of ['Stream A', 'Stream B', 'Stream C', 'Stream D']) {
        const existing = db.get(
          `SELECT id FROM streams WHERE school_id = ? AND class_id = ? AND name = ?`,
          [c.school_id, c.id, sName]
        );
        if (!existing) {
          db.run(
            `INSERT INTO streams (school_id, class_id, name) VALUES (?, ?, ?)`,
            [c.school_id, c.id, sName]
          );
        }
      }
    }
  } catch (err) {
    // If classes table doesn't exist yet, it will run on seed
  }
}

function initSchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(sql);
  ensureDefaultStreams();
  applyPhase1();
  applyPhase2();
  applyPhase2b();
  console.log('[DB] Core database schema applied successfully.');
}

if (require.main === module) {
  initSchema();
}

module.exports = { initSchema };