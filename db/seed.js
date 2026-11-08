/**
 * MR LOGIC SCHOOL SYSTEM - Tanzanian Secondary Schools Database Seeder
 * Populates realistic multi-school data with NECTA grading and authentic records.
 */
const db = require('./database');
const { initSchema } = require('./migrations');
const { hashPassword } = require('../services/authService');
const { processExamResults } = require('../services/gradingService');

function seedDatabase() {
  console.log('[Seed] Initializing database schema...');
  initSchema();

  console.log('[Seed] Checking if data already exists...');
  const existingSchools = db.get('SELECT COUNT(*) as count FROM schools');
  if (existingSchools && existingSchools.count > 0) {
    console.log('[Seed] Database already seeded. Skipping initial seeding.');
    return;
  }

  console.log('[Seed] Seeding multi-school structure and Tanzania NECTA records...');

  db.transaction(() => {
    // 1. Create Super Admin User (Global Scope)
    const superAdminAuth = hashPassword('Admin123!');
    db.run(
      `INSERT INTO users (school_id, full_name, email, username, phone, password_hash, salt, role)
       VALUES (NULL, 'Super Administrator', 'superadmin@mrlogic.tz', 'superadmin', '+255 700 000 001', ?, ?, 'SUPER_ADMIN')`,
      [superAdminAuth.hash, superAdminAuth.salt]
    );

    // 2. School 1: Kilimanjaro Secondary School (Moshi, Kilimanjaro)
    const school1Res = db.run(
      `INSERT INTO schools (code, name, registration_number, motto, address, region, district, phone, email, logo_url)
       VALUES ('TZ-SCH-001', 'Kilimanjaro Secondary School', 'S.1042/2012', 'Elimu ni Mwanga na Nguvu', 'P.O. Box 450, Moshi', 'Kilimanjaro', 'Moshi Municipal', '+255 754 112 233', 'info@kilimanjarosec.sc.tz', '/images/kilimanjaro-logo.png')`
    );
    const s1Id = school1Res.lastInsertRowid;

    // School 2: Bagamoyo High School (Bagamoyo, Pwani) - for testing tenant isolation
    const school2Res = db.run(
      `INSERT INTO schools (code, name, registration_number, motto, address, region, district, phone, email, logo_url)
       VALUES ('TZ-SCH-002', 'Bagamoyo Secondary School', 'S.2088/2015', 'Strive for Academic Excellence', 'P.O. Box 120, Bagamoyo', 'Pwani', 'Bagamoyo District', '+255 768 445 566', 'info@bagamoyosec.sc.tz', '/images/bagamoyo-logo.png')`
    );
    const s2Id = school2Res.lastInsertRowid;

    // Helper for seeding school standard setup
    function setupSchoolCore(schoolId, prefix) {
      // Academic Year 2026
      const yearRes = db.run(
        `INSERT INTO academic_years (school_id, year_label, start_date, end_date, is_current)
         VALUES (?, '2026', '2026-01-12', '2026-11-27', 1)`,
        [schoolId]
      );
      const yearId = yearRes.lastInsertRowid;

      // Terms
      const term1Res = db.run(
        `INSERT INTO academic_terms (school_id, academic_year_id, term_name, start_date, end_date, is_current)
         VALUES (?, ?, 'Term 1', '2026-01-12', '2026-06-05', 1)`,
        [schoolId, yearId]
      );
      const term1Id = term1Res.lastInsertRowid;

      db.run(
        `INSERT INTO academic_terms (school_id, academic_year_id, term_name, start_date, end_date, is_current)
         VALUES (?, ?, 'Term 2', '2026-07-06', '2026-11-27', 0)`,
        [schoolId, yearId]
      );

      // Classes: Form 1 to Form 4
      const formClasses = {};
      const classLevels = [
        { form: 1, name: 'Form 1' },
        { form: 2, name: 'Form 2' },
        { form: 3, name: 'Form 3' },
        { form: 4, name: 'Form 4' }
      ];

      for (const cl of classLevels) {
        const cRes = db.run(
          `INSERT INTO classes (school_id, form_level, name, numeric_order)
           VALUES (?, ?, ?, ?)`,
          [schoolId, cl.form, cl.name, cl.form]
        );
        const cId = cRes.lastInsertRowid;
        formClasses[cl.form] = cId;

        // Streams: A, B, C, D
        db.run(`INSERT INTO streams (school_id, class_id, name) VALUES (?, ?, 'Stream A')`, [schoolId, cId]);
        db.run(`INSERT INTO streams (school_id, class_id, name) VALUES (?, ?, 'Stream B')`, [schoolId, cId]);
        db.run(`INSERT INTO streams (school_id, class_id, name) VALUES (?, ?, 'Stream C')`, [schoolId, cId]);
        db.run(`INSERT INTO streams (school_id, class_id, name) VALUES (?, ?, 'Stream D')`, [schoolId, cId]);
      }

      // Tanzanian O-Level Subjects
      const subjectsList = [
        { code: 'CIV', name: 'Civics', isCore: 1 },
        { code: 'HIST', name: 'History', isCore: 1 },
        { code: 'GEO', name: 'Geography', isCore: 1 },
        { code: 'KISW', name: 'Kiswahili', isCore: 1 },
        { code: 'ENG', name: 'English Language', isCore: 1 },
        { code: 'PHY', name: 'Physics', isCore: 1 },
        { code: 'CHEM', name: 'Chemistry', isCore: 1 },
        { code: 'BIO', name: 'Biology', isCore: 1 },
        { code: 'B/MATH', name: 'Basic Mathematics', isCore: 1 },
        { code: 'COMM', name: 'Commerce', isCore: 0 },
        { code: 'BKPG', name: 'Bookkeeping', isCore: 0 }
      ];

      const subjectsMap = {};
      for (const sub of subjectsList) {
        const sRes = db.run(
          `INSERT INTO subjects (school_id, code, name, is_core, is_active)
           VALUES (?, ?, ?, ?, 1)`,
          [schoolId, sub.code, sub.name, sub.isCore]
        );
        subjectsMap[sub.code] = sRes.lastInsertRowid;
      }

      // NECTA Grading System
      const gSysRes = db.run(
        `INSERT INTO grading_systems (school_id, name, is_default, min_subjects_required, points_calculation_method)
         VALUES (?, 'NECTA Standard O-Level', 1, 7, 'BEST_7')`,
        [schoolId]
      );
      const gSysId = gSysRes.lastInsertRowid;

      // Grading Rules (A, B, C, D, F)
      const gradingScales = [
        { grade: 'A', min: 75, max: 100, points: 1, remark: 'Distinction (Bora Sana)', gpa: 1.0 },
        { grade: 'B', min: 65, max: 74.99, points: 2, remark: 'Very Good (Vizuri Sana)', gpa: 2.0 },
        { grade: 'C', min: 45, max: 64.99, points: 3, remark: 'Good (Vizuri)', gpa: 3.0 },
        { grade: 'D', min: 30, max: 44.99, points: 4, remark: 'Satisfactory (Wastani)', gpa: 4.0 },
        { grade: 'F', min: 0, max: 29.99, points: 5, remark: 'Fail (Feli)', gpa: 5.0 }
      ];

      for (const scale of gradingScales) {
        db.run(
          `INSERT INTO grading_rules (grading_system_id, grade, min_score, max_score, points, remark, gpa_point)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [gSysId, scale.grade, scale.min, scale.max, scale.points, scale.remark, scale.gpa]
        );
      }

      // Division Rules
      const divisionRules = [
        { div: 'I', minPts: 7, maxPts: 17, notes: 'Points 7-17 (Distinction to High Credit)' },
        { div: 'II', minPts: 18, maxPts: 21, notes: 'Points 18-21 (Credit)' },
        { div: 'III', minPts: 22, maxPts: 25, notes: 'Points 22-25 (Moderate Pass)' },
        { div: 'IV', minPts: 26, maxPts: 33, notes: 'Points 26-33 (Minimum 2 passes required)' },
        { div: '0', minPts: 34, maxPts: 35, notes: 'Points 34-35 or failure to secure minimum passes' }
      ];

      for (const div of divisionRules) {
        db.run(
          `INSERT INTO division_rules (grading_system_id, division, min_points, max_points, criteria_notes)
           VALUES (?, ?, ?, ?, ?)`,
          [gSysId, div.div, div.minPts, div.maxPts, div.notes]
        );
      }

      // Users for School
      const defaultAuth = hashPassword('Admin123!');
      const teacherAuth = hashPassword('Teacher123!');

      // School Admin
      const adminRes = db.run(
        `INSERT INTO users (school_id, full_name, email, username, phone, password_hash, salt, role)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'SCHOOL_ADMIN')`,
        [
          schoolId,
          `${prefix} Headmaster`,
          `admin@${prefix.toLowerCase()}.tz`,
          `${prefix.toLowerCase()}.admin`,
          '+255 754 000 111',
          defaultAuth.hash,
          defaultAuth.salt
        ]
      );

      // Academic Master
      const academicRes = db.run(
        `INSERT INTO users (school_id, full_name, email, username, phone, password_hash, salt, role)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ACADEMIC_MASTER')`,
        [
          schoolId,
          `${prefix} Academic Master`,
          `academic@${prefix.toLowerCase()}.tz`,
          `${prefix.toLowerCase()}.academic`,
          '+255 754 000 222',
          defaultAuth.hash,
          defaultAuth.salt
        ]
      );

      // Teachers
      const teacher1Username = `${prefix.toLowerCase()}.teacher1`;
      const teacher1Email = `teacher1@${prefix.toLowerCase()}.tz`;
      const teacher1Name = prefix === 'Kilimanjaro' ? 'Mwl. Peter Massawe' : 'Mwl. Ally Rashid';
      const teacher1User = db.run(
        `INSERT INTO users (school_id, full_name, email, username, phone, password_hash, salt, role)
         VALUES (?, ?, ?, ?, '+255 712 334 455', ?, ?, 'TEACHER')`,
        [schoolId, teacher1Name, teacher1Email, teacher1Username, teacherAuth.hash, teacherAuth.salt]
      );

      const teacher1 = db.run(
        `INSERT INTO teachers (school_id, user_id, staff_id, first_name, last_name, gender, phone, email, qualification)
         VALUES (?, ?, 'TS/001', ?, ?, 'M', '+255 712 334 455', ?, 'B.Sc. Education (Maths/Physics)')`,
        [schoolId, teacher1User.lastInsertRowid, prefix === 'Kilimanjaro' ? 'Peter' : 'Ally', prefix === 'Kilimanjaro' ? 'Massawe' : 'Rashid', teacher1Email]
      );

      const teacher2Username = `${prefix.toLowerCase()}.teacher2`;
      const teacher2Email = `teacher2@${prefix.toLowerCase()}.tz`;
      const teacher2Name = prefix === 'Kilimanjaro' ? 'Mwl. Grace Mwangi' : 'Mwl. Rehema Salim';
      const teacher2User = db.run(
        `INSERT INTO users (school_id, full_name, email, username, phone, password_hash, salt, role)
         VALUES (?, ?, ?, ?, '+255 715 667 788', ?, ?, 'TEACHER')`,
        [schoolId, teacher2Name, teacher2Email, teacher2Username, teacherAuth.hash, teacherAuth.salt]
      );

      const teacher2 = db.run(
        `INSERT INTO teachers (school_id, user_id, staff_id, first_name, last_name, gender, phone, email, qualification)
         VALUES (?, ?, 'TS/002', ?, ?, 'F', '+255 715 667 788', ?, 'B.A. Education (English/Kiswahili)')`,
        [schoolId, teacher2User.lastInsertRowid, prefix === 'Kilimanjaro' ? 'Grace' : 'Rehema', prefix === 'Kilimanjaro' ? 'Mwangi' : 'Salim', teacher2Email]
      );

      return {
        yearId,
        term1Id,
        formClasses,
        subjectsMap,
        gSysId,
        teacher1Id: teacher1.lastInsertRowid,
        teacher2Id: teacher2.lastInsertRowid
      };
    }

    const s1Data = setupSchoolCore(s1Id, 'Kilimanjaro');
    const s2Data = setupSchoolCore(s2Id, 'Bagamoyo');

    // 3. Populate Students for Kilimanjaro Secondary School (Forms 1 - 4)
    const streamRows = db.all(`SELECT id, class_id, name FROM streams WHERE school_id = ?`, [s1Id]);
    const form4Streams = streamRows.filter(s => s.class_id === s1Data.formClasses[4]);

    const studentRoster = [
      { first: 'Juma', middle: 'Bakari', last: 'Omari', gender: 'M', reg: 'S1042/001/2023', classForm: 4, streamIdx: 0, scores: [84, 78, 88, 76, 82, 85, 79, 90, 81] },
      { first: 'Neema', middle: 'Charles', last: 'Mwangi', gender: 'F', reg: 'S1042/002/2023', classForm: 4, streamIdx: 0, scores: [76, 82, 80, 71, 75, 68, 84, 82, 79] },
      { first: 'Baraka', middle: 'John', last: 'Mushi', gender: 'M', reg: 'S1042/003/2023', classForm: 4, streamIdx: 0, scores: [65, 70, 72, 60, 68, 62, 70, 75, 69] },
      { first: 'Asha', middle: 'Rashid', last: 'Khamis', gender: 'F', reg: 'S1042/004/2023', classForm: 4, streamIdx: 0, scores: [78, 85, 82, 80, 77, 72, 81, 88, 86] },
      { first: 'Emmanuel', middle: 'Joseph', last: 'Kibona', gender: 'M', reg: 'S1042/005/2023', classForm: 4, streamIdx: 1, scores: [58, 62, 64, 52, 60, 55, 63, 67, 59] },
      { first: 'Fatuma', middle: 'Salum', last: 'Mkude', gender: 'F', reg: 'S1042/006/2023', classForm: 4, streamIdx: 1, scores: [48, 52, 55, 45, 50, 42, 54, 58, 49] },
      { first: 'Daudi', middle: 'Paul', last: 'Lyimo', gender: 'M', reg: 'S1042/007/2023', classForm: 4, streamIdx: 1, scores: [72, 75, 78, 66, 70, 68, 74, 80, 73] },
      { first: 'Grace', middle: 'Aloyce', last: 'Shirima', gender: 'F', reg: 'S1042/008/2023', classForm: 4, streamIdx: 1, scores: [38, 42, 45, 32, 40, 36, 44, 48, 39] },
      { first: 'Kelvin', middle: 'Eliud', last: 'Makundi', gender: 'M', reg: 'S1042/009/2023', classForm: 4, streamIdx: 0, scores: [88, 92, 94, 85, 90, 89, 91, 95, 93] },
      { first: 'Zena', middle: 'Hassan', last: 'Ally', gender: 'F', reg: 'S1042/010/2023', classForm: 4, streamIdx: 0, scores: [26, 28, 30, 22, 25, 20, 32, 29, 24] },
      { first: 'Frank', middle: 'David', last: 'Mlay', gender: 'M', reg: 'S1042/011/2023', classForm: 4, streamIdx: 1, scores: [62, 66, 68, 58, 64, 59, 67, 71, 65] },
      { first: 'Mariam', middle: 'Nassoro', last: 'Juma', gender: 'F', reg: 'S1042/012/2023', classForm: 4, streamIdx: 1, scores: [81, 84, 86, 79, 83, 78, 85, 89, 87] }
    ];

    const studentIds = [];
    const studentScoresMap = new Map();

    for (const st of studentRoster) {
      const streamId = form4Streams[st.streamIdx]?.id || form4Streams[0]?.id;
      const classId = s1Data.formClasses[st.classForm];

      const sRes = db.run(
        `INSERT INTO students (school_id, reg_number, first_name, middle_name, last_name, gender, date_of_birth, admission_date, current_class_id, current_stream_id, parent_name, parent_phone, status)
         VALUES (?, ?, ?, ?, ?, ?, '2008-04-15', '2023-01-10', ?, ?, 'Mzee ' || ?, '+255 788 123 456', 'ACTIVE')`,
        [s1Id, st.reg, st.first, st.middle, st.last, st.gender, classId, streamId, st.last]
      );
      const studentId = sRes.lastInsertRowid;
      studentIds.push(studentId);
      studentScoresMap.set(studentId, st.scores);

      db.run(
        `INSERT INTO student_enrollments (school_id, student_id, academic_year_id, class_id, stream_id, status)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
        [s1Id, studentId, s1Data.yearId, classId, streamId]
      );
    }

    // 4. Create Examination: Form 4 Mock Examination 2026
    const examRes = db.run(
      `INSERT INTO examinations (school_id, academic_year_id, term_id, class_id, name, exam_type, start_date, end_date, is_locked, grading_system_id)
       VALUES (?, ?, ?, ?, 'Form 4 Regional Mock Examination 2026', 'MOCK', '2026-03-02', '2026-03-13', 0, ?)`,
      [s1Id, s1Data.yearId, s1Data.term1Id, s1Data.formClasses[4], s1Data.gSysId]
    );
    const examId = examRes.lastInsertRowid;

    // Subjects to enter marks for
    const coreSubjectCodes = ['CIV', 'HIST', 'GEO', 'KISW', 'ENG', 'PHY', 'CHEM', 'BIO', 'B/MATH'];
    const examSubjects = coreSubjectCodes.map(c => ({
      code: c,
      id: s1Data.subjectsMap[c]
    }));

    // Record Examination Marks for each student
    const insertMarkStmt = db.prepare(`
      INSERT INTO exam_marks (school_id, examination_id, student_id, subject_id, marks, entered_by_user_id)
      VALUES (?, ?, ?, ?, ?, 1)
    `);

    for (const [sId, scores] of studentScoresMap.entries()) {
      scores.forEach((score, idx) => {
        if (examSubjects[idx]) {
          insertMarkStmt.run(s1Id, examId, sId, examSubjects[idx].id, score);
        }
      });
    }

    // Also add a second exam: Form 2 Midterm Examination 2026
    db.run(
      `INSERT INTO examinations (school_id, academic_year_id, term_id, class_id, name, exam_type, start_date, end_date, is_locked, grading_system_id)
       VALUES (?, ?, ?, ?, 'Form 2 Mid-Term Examination 2026', 'MIDTERM', '2026-02-16', '2026-02-20', 0, ?)`,
      [s1Id, s1Data.yearId, s1Data.term1Id, s1Data.formClasses[2], s1Data.gSysId]
    );

    // 5. Populate Students for Bagamoyo Secondary School (to test multi-school isolation)
    const s2StreamRows = db.all(`SELECT id, class_id, name FROM streams WHERE school_id = ?`, [s2Id]);
    const s2Form4Streams = s2StreamRows.filter(s => s.class_id === s2Data.formClasses[4]);

    const s2StudentRoster = [
      { first: 'Rashid', middle: 'Ali', last: 'Mwinyi', gender: 'M', reg: 'S2088/001/2023', classForm: 4, streamIdx: 0 },
      { first: 'Subira', middle: 'Kassim', last: 'Bakari', gender: 'F', reg: 'S2088/002/2023', classForm: 4, streamIdx: 0 },
      { first: 'Goodluck', middle: 'Peter', last: 'Mollel', gender: 'M', reg: 'S2088/003/2023', classForm: 4, streamIdx: 1 },
      { first: 'Amina', middle: 'Said', last: 'Khatibu', gender: 'F', reg: 'S2088/004/2023', classForm: 4, streamIdx: 1 }
    ];

    for (const st of s2StudentRoster) {
      const streamId = s2Form4Streams[st.streamIdx]?.id || s2Form4Streams[0]?.id;
      const classId = s2Data.formClasses[st.classForm];

      const sRes = db.run(
        `INSERT INTO students (school_id, reg_number, first_name, middle_name, last_name, gender, date_of_birth, admission_date, current_class_id, current_stream_id, parent_name, parent_phone, status)
         VALUES (?, ?, ?, ?, ?, ?, '2008-07-22', '2023-01-10', ?, ?, 'Mzee ' || ?, '+255 766 998 877', 'ACTIVE')`,
        [s2Id, st.reg, st.first, st.middle, st.last, st.gender, classId, streamId, st.last]
      );

      db.run(
        `INSERT INTO student_enrollments (school_id, student_id, academic_year_id, class_id, stream_id, status)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
        [s2Id, sRes.lastInsertRowid, s2Data.yearId, classId, streamId]
      );
    }

    console.log('[Seed] Multi-school foundation created successfully.');
  });

  // Run official NECTA processing for the seeded Form 4 Mock Exam
  console.log('[Seed] Processing NECTA results for Form 4 Regional Mock Examination...');
  const firstExam = db.get(`SELECT id, school_id FROM examinations LIMIT 1`);
  if (firstExam) {
    processExamResults(firstExam.id, firstExam.school_id);
    console.log('[Seed] Form 4 Mock Exam processed with NECTA Divisions & Ranks.');
  }

  console.log('[Seed] Database initialization complete!');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
