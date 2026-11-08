/**
 * MR LOGIC SCHOOL SYSTEM - School Leadership Accounts Service
 */
const crypto = require('node:crypto');
const db = require('../db/database');
const { hashPassword } = require('./authService');
const { generateUniqueUsername } = require('./teacherService');

const STAFF_ROLES = [
  'SCHOOL_ADMIN', 'HEAD_TEACHER', 'SCHOOL_MANAGER',
  'ACADEMIC_MASTER', 'ACADEMIC_ASSISTANT'
];

function listStaff(schoolId) {
  return db.all(
    `SELECT id, school_id, full_name, username, email, phone, role, is_active, last_login, created_at
     FROM users
     WHERE school_id = ? AND role != 'TEACHER'
     ORDER BY id ASC`,
    [schoolId]
  );
}

function createStaff(schoolId, data, creatorRole) {
  const d = data && typeof data === 'object' ? data : {};
  const fullName = typeof d.fullName === 'string' ? d.fullName.trim() : '';
  const role = d.role;
  const phone = typeof d.phone === 'string' && d.phone.trim() ? d.phone.trim() : null;

  if (!fullName) throw new Error('Jina kamili linahitajika.');
  if (!STAFF_ROLES.includes(role)) throw new Error('Cheo (role) si sahihi.');
  if (role === 'SCHOOL_ADMIN' && creatorRole !== 'SUPER_ADMIN') {
    throw new Error('Ni SUPER_ADMIN pekee anayeweza kusajili SCHOOL_ADMIN.');
  }

  const school = db.get(`SELECT id, code FROM schools WHERE id = ?`, [schoolId]);
  if (!school) throw new Error('Shule haipatikani.');

  if (role === 'ACADEMIC_MASTER') {
    const existing = db.get(
      `SELECT id FROM users WHERE school_id = ? AND role = 'ACADEMIC_MASTER' AND is_active = 1`,
      [schoolId]
    );
    if (existing) {
      throw new Error('Shule hii tayari ina Mtaaluma Mkuu. Tumia Mtaaluma Msaidizi.');
    }
  }

  const username = generateUniqueUsername(fullName);
  if (!username) throw new Error('Imeshindikana kutengeneza username kutoka kwa jina hilo.');

  const generated = !(typeof d.password === 'string' && d.password.length >= 8);
  const password = generated
    ? 'Ml' + crypto.randomBytes(5).toString('hex') + '#'
    : d.password;
  const auth = hashPassword(password);

  const schoolCode = school.code ? school.code.toLowerCase().replace(/[^a-z0-9]/g, '') : 'sch';
  const email = `${username.toLowerCase()}@${schoolCode}.mrlogic.tz`;

  const res = db.run(
    `INSERT INTO users (school_id, full_name, email, username, phone, password_hash, salt, role)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [schoolId, fullName, email, username, phone, auth.hash, auth.salt, role]
  );

  return {
    user: { id: Number(res.lastInsertRowid), school_id: schoolId, full_name: fullName, username, role },
    temporaryPassword: generated ? password : null
  };
}

module.exports = { STAFF_ROLES, listStaff, createStaff };