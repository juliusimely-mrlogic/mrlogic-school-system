/**
 * MR LOGIC SCHOOL SYSTEM - School & Multi-Tenancy Service
 */
const db = require('../db/database');
const { ensureLevelSetup } = require('./levelService');

const OWNER_TYPES = ['GOVERNMENT', 'PRIVATE'];
const LEVELS = ['PRIMARY', 'O_LEVEL', 'A_LEVEL'];
const LANGS = ['sw', 'en', 'fr'];

function clean(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function validateSchoolInput(data, isCreate) {
  const d = data && typeof data === 'object' ? data : {};
  const out = {
    code: clean(d.code), name: clean(d.name),
    registrationNumber: clean(d.registrationNumber), motto: clean(d.motto),
    address: clean(d.address), region: clean(d.region),
    district: clean(d.district), ward: clean(d.ward),
    phone: clean(d.phone), email: clean(d.email),
    examNumber: clean(d.examNumber), headTeacherName: clean(d.headTeacherName),
    ownerType: clean(d.ownerType), schoolLevels: null, languages: null,
    isActive: d.isActive === undefined ? null : (d.isActive ? 1 : 0)
  };

  if (isCreate) {
    const required = [['name', 'Jina la shule'], ['code', 'Code ya shule'],
                      ['region', 'Mkoa'], ['district', 'Halmashauri']];
    for (const [key, label] of required) {
      if (!out[key]) throw new Error(`${label} linahitajika.`);
    }
    out.ownerType = out.ownerType || 'GOVERNMENT';
  }
  if (out.ownerType && !OWNER_TYPES.includes(out.ownerType)) {
    throw new Error('Umiliki lazima uwe GOVERNMENT au PRIVATE.');
  }

  if (d.schoolLevels !== undefined) {
    const lv = Array.isArray(d.schoolLevels) ? d.schoolLevels : [d.schoolLevels];
    if (!lv.length || !lv.every(x => LEVELS.includes(x))) {
      throw new Error('Ngazi lazima ziwe PRIMARY, O_LEVEL au A_LEVEL.');
    }
    out.schoolLevels = lv.join(',');
  } else if (isCreate) {
    out.schoolLevels = 'O_LEVEL';
  }

  if (d.languages !== undefined) {
    const lg = Array.isArray(d.languages) ? d.languages : [d.languages];
    if (!lg.length || !lg.every(x => LANGS.includes(x))) {
      throw new Error('Lugha lazima ziwe sw, en au fr.');
    }
    out.languages = JSON.stringify(lg);
  } else if (isCreate) {
    out.languages = '["sw"]';
  }
  return out;
}

function getAllSchools() {
  const schools = db.all(`
    SELECT s.*,
           (SELECT COUNT(*) FROM students WHERE school_id = s.id AND status = 'ACTIVE') as total_students,
           (SELECT COUNT(*) FROM teachers WHERE school_id = s.id AND status = 'ACTIVE') as total_teachers,
           (SELECT COUNT(*) FROM classes WHERE school_id = s.id) as total_classes,
           (SELECT COUNT(*) FROM examinations WHERE school_id = s.id) as total_exams
    FROM schools s
    ORDER BY s.name ASC
  `);
  return schools;
}

function getSchoolById(id) {
  const school = db.get(`SELECT * FROM schools WHERE id = ?`, [id]);
  if (!school) return null;

  const currentYear = db.get(
    `SELECT * FROM academic_years WHERE school_id = ? AND is_current = 1 LIMIT 1`,
    [id]
  );
  const currentTerm = currentYear
    ? db.get(
        `SELECT * FROM academic_terms WHERE school_id = ? AND academic_year_id = ? AND is_current = 1 LIMIT 1`,
        [id, currentYear.id]
      )
    : null;

  return {
    ...school,
    currentAcademicYear: currentYear,
    currentTerm
  };
}

function createSchool(data) {
  const { code, name, registrationNumber, motto, address, region, district, ward,
    phone, email, ownerType, schoolLevels, examNumber, headTeacherName, languages
  } = validateSchoolInput(data, true);

  const res = db.run(
    `INSERT INTO schools (code, name, registration_number, motto, address, region, district, ward,
       phone, email, owner_type, school_levels, exam_number, head_teacher_name, languages)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [code, name, registrationNumber, motto, address, region, district, ward,
     phone, email, ownerType, schoolLevels, examNumber, headTeacherName, languages]
  );
  const schoolId = res.lastInsertRowid;

  // Create default Academic Year 2026
  const yRes = db.run(
    `INSERT INTO academic_years (school_id, year_label, start_date, end_date, is_current)
     VALUES (?, '2026', '2026-01-12', '2026-11-27', 1)`,
    [schoolId]
  );
  const yId = yRes.lastInsertRowid;

  // Create Term 1 and Term 2
  db.run(
    `INSERT INTO academic_terms (school_id, academic_year_id, term_name, start_date, end_date, is_current)
     VALUES (?, ?, 'Term 1', '2026-01-12', '2026-06-05', 1)`,
    [schoolId, yId]
  );
  db.run(
    `INSERT INTO academic_terms (school_id, academic_year_id, term_name, start_date, end_date, is_current)
     VALUES (?, ?, 'Term 2', '2026-07-06', '2026-11-27', 0)`,
    [schoolId, yId]
  );

  // Create classes (with Streams A-D), subjects and combinations for each selected level
  ensureLevelSetup(schoolId, schoolLevels);

  // Create standard NECTA grading system
  const gSysRes = db.run(
    `INSERT INTO grading_systems (school_id, name, is_default, min_subjects_required, points_calculation_method)
     VALUES (?, 'NECTA Standard O-Level', 1, 7, 'BEST_7')`,
    [schoolId]
  );
  const gSysId = gSysRes.lastInsertRowid;

  const scales = [
    { grade: 'A', min: 75, max: 100, points: 1, remark: 'Distinction (Bora Sana)', gpa: 1.0 },
    { grade: 'B', min: 65, max: 74.99, points: 2, remark: 'Very Good (Vizuri Sana)', gpa: 2.0 },
    { grade: 'C', min: 45, max: 64.99, points: 3, remark: 'Good (Vizuri)', gpa: 3.0 },
    { grade: 'D', min: 30, max: 44.99, points: 4, remark: 'Satisfactory (Wastani)', gpa: 4.0 },
    { grade: 'F', min: 0, max: 29.99, points: 5, remark: 'Fail (Feli)', gpa: 5.0 }
  ];

  for (const s of scales) {
    db.run(
      `INSERT INTO grading_rules (grading_system_id, grade, min_score, max_score, points, remark, gpa_point)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [gSysId, s.grade, s.min, s.max, s.points, s.remark, s.gpa]
    );
  }

  const divs = [
    { div: 'I', minPts: 7, maxPts: 17, notes: 'Points 7-17' },
    { div: 'II', minPts: 18, maxPts: 21, notes: 'Points 18-21' },
    { div: 'III', minPts: 22, maxPts: 25, notes: 'Points 22-25' },
    { div: 'IV', minPts: 26, maxPts: 33, notes: 'Points 26-33' },
    { div: '0', minPts: 34, maxPts: 35, notes: 'Points 34-35' }
  ];

  for (const d of divs) {
    db.run(
      `INSERT INTO division_rules (grading_system_id, division, min_points, max_points, criteria_notes)
       VALUES (?, ?, ?, ?, ?)`,
      [gSysId, d.div, d.minPts, d.maxPts, d.notes]
    );
  }

  return getSchoolById(schoolId);
}

function updateSchool(id, data) {
  const f = validateSchoolInput(data, false);
  db.run(
    `UPDATE schools SET
       name = COALESCE(?, name),
       registration_number = COALESCE(?, registration_number),
       motto = COALESCE(?, motto),
       address = COALESCE(?, address),
       region = COALESCE(?, region),
       district = COALESCE(?, district),
       ward = COALESCE(?, ward),
       phone = COALESCE(?, phone),
       email = COALESCE(?, email),
       owner_type = COALESCE(?, owner_type),
       school_levels = COALESCE(?, school_levels),
       exam_number = COALESCE(?, exam_number),
       head_teacher_name = COALESCE(?, head_teacher_name),
       languages = COALESCE(?, languages),
       is_active = COALESCE(?, is_active)
     WHERE id = ?`,
    [f.name, f.registrationNumber, f.motto, f.address, f.region, f.district, f.ward,
     f.phone, f.email, f.ownerType, f.schoolLevels, f.examNumber, f.headTeacherName,
     f.languages, f.isActive, id]
  );
  if (f.schoolLevels) ensureLevelSetup(id, f.schoolLevels);
  return getSchoolById(id);
}

module.exports = {
  getAllSchools,
  getSchoolById,
  createSchool,
  updateSchool
};