/**
 * MR LOGIC SCHOOL SYSTEM - Automated Verification Test Suite
 * Tests: Multi-tenancy, Authentication, NECTA Grading Calculations, API Dispatcher
 */
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'isolated-system-test-secret-material-32-bytes-minimum';

const assert = require('node:assert');
const db = require('../db/database');
const { initSchema } = require('../db/migrations');
const { seedDatabase } = require('../db/seed');
const authService = require('../services/authService');
const schoolService = require('../services/schoolService');
const studentService = require('../services/studentService');
const teacherService = require('../services/teacherService');
const examService = require('../services/examService');
const gradingService = require('../services/gradingService');
const reportService = require('../services/reportService');
const dashboardService = require('../services/dashboardService');
const { handleApiRequest } = require('../routes/api');

let totalTests = 0;
let passedTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${testName}`);
    console.error(`         ${err.message}`);
  }
}

console.log('================================================================');
console.log('       RUNNING MR LOGIC SCHOOL SYSTEM AUTOMATED TEST SUITE       ');
console.log('================================================================');

// 1. Database & Seeding Tests
console.log('\n--- 1. DATABASE & MULTI-TENANT FOUNDATION ---');
runTest('Database connects and tables are initialized', () => {
  initSchema();
  const tables = db.all(`SELECT name FROM sqlite_master WHERE type='table'`);
  const tableNames = tables.map(t => t.name);
  assert.ok(tableNames.includes('schools'), 'Missing schools table');
  assert.ok(tableNames.includes('users'), 'Missing users table');
  assert.ok(tableNames.includes('students'), 'Missing students table');
  assert.ok(tableNames.includes('examinations'), 'Missing examinations table');
  assert.ok(tableNames.includes('exam_marks'), 'Missing exam_marks table');
  assert.ok(tableNames.includes('exam_processed_results'), 'Missing exam_processed_results table');
});

runTest('Multi-school seeding contains at least 2 distinct schools', () => {
  seedDatabase();
  const schools = schoolService.getAllSchools();
  assert.ok(schools.length >= 2, `Expected at least 2 schools, found ${schools.length}`);
  const s1 = schools.find(s => s.code === 'TZ-SCH-001');
  const s2 = schools.find(s => s.code === 'TZ-SCH-002');
  assert.ok(s1, 'Kilimanjaro Secondary School missing');
  assert.ok(s2, 'Bagamoyo Secondary School missing');
});

runTest('Strict Multi-School Tenant Isolation (Zero Cross-School Leakage)', () => {
  const schools = schoolService.getAllSchools();
  const s1 = schools.find(s => s.code === 'TZ-SCH-001');
  const s2 = schools.find(s => s.code === 'TZ-SCH-002');
  assert.ok(s1 && s2, 'Both schools must exist');

  const s1Students = studentService.getStudents(s1.id, { limit: 100 }).students;
  const s2Students = studentService.getStudents(s2.id, { limit: 100 }).students;

  assert.ok(s1Students.length > 0, 'School 1 should have students');
  assert.ok(s2Students.length > 0, 'School 2 should have students');

  // Verify School 1 students only belong to School 1
  for (const st1 of s1Students) {
    assert.strictEqual(st1.school_id, s1.id);
    const leaked = s2Students.find(st2 => st2.id === st1.id);
    assert.strictEqual(leaked, undefined, `Data leak! Student ${st1.id} from school ${s1.id} found in school ${s2.id}`);
  }

  // Verify School 2 students only belong to School 2
  for (const st2 of s2Students) {
    assert.strictEqual(st2.school_id, s2.id);
  }
});

// 2. Authentication & Cryptography Tests
console.log('\n--- 2. AUTHENTICATION & SECURITY ---');
runTest('Super Admin authentication succeeds with valid credentials', () => {
  const res = authService.authenticateUser('superadmin', 'Admin123!');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.user.role, 'SUPER_ADMIN');
  assert.ok(res.token, 'Token must be generated');
});

runTest('Authentication fails with invalid password', () => {
  const res = authService.authenticateUser('superadmin', 'WrongPass123!');
  assert.strictEqual(res.success, false);
});

runTest('JWT Token verification and payload extraction', () => {
  const token = authService.generateToken({ userId: 99, role: 'ACADEMIC_MASTER' });
  const payload = authService.verifyToken(token);
  assert.strictEqual(payload.userId, 99);
  assert.strictEqual(payload.role, 'ACADEMIC_MASTER');
});

// 3. NECTA Grading Engine Calculations
console.log('\n--- 3. TANZANIAN NECTA GRADING ENGINE ---');
runTest('NECTA Grade scales: 85=A(1pt), 70=B(2pt), 55=C(3pt), 35=D(4pt), 20=F(5pt)', () => {
  const rules = gradingService.DEFAULT_NECTA_RULES;
  assert.strictEqual(gradingService.calculateGradeForMark(85, rules).grade, 'A');
  assert.strictEqual(gradingService.calculateGradeForMark(85, rules).points, 1);
  assert.strictEqual(gradingService.calculateGradeForMark(70, rules).grade, 'B');
  assert.strictEqual(gradingService.calculateGradeForMark(70, rules).points, 2);
  assert.strictEqual(gradingService.calculateGradeForMark(55, rules).grade, 'C');
  assert.strictEqual(gradingService.calculateGradeForMark(55, rules).points, 3);
  assert.strictEqual(gradingService.calculateGradeForMark(35, rules).grade, 'D');
  assert.strictEqual(gradingService.calculateGradeForMark(35, rules).points, 4);
  assert.strictEqual(gradingService.calculateGradeForMark(20, rules).grade, 'F');
  assert.strictEqual(gradingService.calculateGradeForMark(20, rules).points, 5);
});

runTest('NECTA Division: 7 pts = Div I, 19 pts = Div II, 23 pts = Div III, 28 pts = Div IV, 35 pts = Div 0', () => {
  assert.strictEqual(gradingService.calculateDivisionFromPoints(7, 7), 'I');
  assert.strictEqual(gradingService.calculateDivisionFromPoints(17, 7), 'I');
  assert.strictEqual(gradingService.calculateDivisionFromPoints(18, 7), 'II');
  assert.strictEqual(gradingService.calculateDivisionFromPoints(21, 7), 'II');
  assert.strictEqual(gradingService.calculateDivisionFromPoints(22, 7), 'III');
  assert.strictEqual(gradingService.calculateDivisionFromPoints(25, 7), 'III');
  assert.strictEqual(gradingService.calculateDivisionFromPoints(28, 4), 'IV');
  assert.strictEqual(gradingService.calculateDivisionFromPoints(34, 1), '0');
  assert.strictEqual(gradingService.calculateDivisionFromPoints(35, 0), '0');
  // Student with points < 26 but fewer than 2 passes must be Division 0
  assert.strictEqual(gradingService.calculateDivisionFromPoints(22, 1), '0');
});

runTest('Exam Results Processing computes Best 7 Points and Class Ranks', () => {
  const exam = db.get(`SELECT id, school_id FROM examinations LIMIT 1`);
  assert.ok(exam, 'No examination found to test');
  const result = gradingService.processExamResults(exam.id, exam.school_id);
  assert.strictEqual(result.success, true);
  assert.ok(result.totalStudents > 0);

  // Verify rank 1 has the best performance
  const rank1 = result.processedList[0];
  assert.strictEqual(rank1.classRank, 1);
  assert.strictEqual(rank1.division, 'I');
  assert.strictEqual(rank1.bestSevenPoints, 7);
});

// 4. Reports and Analytics
console.log('\n--- 4. REPORTS, BROADSHEETS & ANALYTICS ---');
runTest('Broadsheet generates all subject columns and student records', () => {
  const exam = db.get(`SELECT id, school_id FROM examinations LIMIT 1`);
  const broadsheet = reportService.getExamBroadsheet(exam.school_id, exam.id);
  assert.ok(broadsheet.subjects.length > 0, 'Broadsheet must have subject columns');
  assert.ok(broadsheet.rows.length > 0, 'Broadsheet must have student rows');
  const firstRow = broadsheet.rows[0];
  assert.ok(firstRow.fullName, 'Student full name required');
  assert.ok(firstRow.division, 'Student division required');
});

runTest('Student individual report card includes subject marks, ranks, and school details', () => {
  const exam = db.get(`SELECT id, school_id FROM examinations LIMIT 1`);
  const candidate = db.get(`SELECT DISTINCT student_id FROM exam_marks WHERE examination_id = ? LIMIT 1`, [exam.id]);
  assert.ok(candidate, 'Candidate with examination marks required');
  const card = reportService.getStudentReportCard(exam.school_id, exam.id, candidate.student_id);
  assert.strictEqual(card.student.id, candidate.student_id);
  assert.ok(card.school.name, 'School name required on report card');
  assert.ok(card.marks.length > 0, 'Marks required on report card');
});

runTest('Dashboard Summary aggregates Tanzanian O-Level KPIs', () => {
  const exam = db.get(`SELECT id, school_id FROM examinations LIMIT 1`);
  const summary = dashboardService.getDashboardSummary(exam.school_id);
  assert.ok(summary.stats.totalStudents > 0);
  assert.ok(summary.stats.totalTeachers > 0);
  assert.ok(summary.divisionDistribution, 'Division distribution required');
  assert.ok(summary.topStudents.length > 0, 'Top students required');
});

// 5. API Dispatcher Mock Requests
console.log('\n--- 5. API DISPATCHER & ENDPOINTS ---');
function mockApiCall(method, pathname, query = {}, body = {}, headers = {}) {
  return new Promise((resolve) => {
    let responseStatus = 200;
    let responseHeaders = {};
    let responseBody = '';

    const req = {
      method,
      url: pathname,
      headers: { ...headers }
    };

    const res = {
      writeHead(status, hdrs) {
        responseStatus = status;
        responseHeaders = hdrs;
      },
      end(data) {
        responseBody = data;
        let parsed = null;
        try {
          parsed = JSON.parse(responseBody);
        } catch (e) {
          parsed = responseBody;
        }
        resolve({ status: responseStatus, headers: responseHeaders, data: parsed });
      }
    };

    handleApiRequest(req, res, pathname, query, body);
  });
}

runTest('API Endpoint: GET /api/dashboard returns HTTP 200 with stats', async () => {
  const res = await mockApiCall('GET', '/api/dashboard', { school_id: 1 });
  assert.strictEqual(res.status, 200);
  assert.ok(res.data.stats, 'Dashboard stats missing in API response');
});

runTest('API Endpoint: GET /api/students returns student roster with pagination', async () => {
  const res = await mockApiCall('GET', '/api/students', { school_id: 1, limit: 10 });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.data.students));
  assert.ok(res.data.total > 0);
});

runTest('API Endpoint: GET /api/exams returns list of examinations', async () => {
  const res = await mockApiCall('GET', '/api/exams', { school_id: 1 });
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.data.exams));
});

// 6. Student Stream Allocation & Validation Tests
console.log('\n--- 6. STUDENT STREAM ALLOCATION & VALIDATION ---');
const academicService = require('../services/academicService');

runTest('Student registration without STREAM must fail validation', () => {
  const school = schoolService.getAllSchools().find(s => s.code === 'TZ-SCH-001');
  const form1 = db.get(`SELECT id FROM classes WHERE school_id = ? AND form_level = 1`, [school.id]);

  assert.throws(() => {
    studentService.createStudent(school.id, {
      regNumber: 'S1042/TEST/NOSTREAM',
      firstName: 'Test',
      lastName: 'Student',
      gender: 'M',
      classId: form1.id,
      streamId: null // Stream missing
    });
  }, /STREAM is required/);
});

runTest('Student registration with mismatched stream (wrong class) must fail validation', () => {
  const school = schoolService.getAllSchools().find(s => s.code === 'TZ-SCH-001');
  const form1 = db.get(`SELECT id FROM classes WHERE school_id = ? AND form_level = 1`, [school.id]);
  const form4 = db.get(`SELECT id FROM classes WHERE school_id = ? AND form_level = 4`, [school.id]);
  const form4Stream = db.get(`SELECT id FROM streams WHERE school_id = ? AND class_id = ? LIMIT 1`, [school.id, form4.id]);

  assert.throws(() => {
    studentService.createStudent(school.id, {
      regNumber: 'S1042/TEST/MISMATCH',
      firstName: 'Test',
      lastName: 'Mismatch',
      gender: 'F',
      classId: form1.id, // Form 1
      streamId: form4Stream.id // Form 4 stream!
    });
  }, /Stream mismatch/);
});

runTest('Student registration with cross-school stream must fail validation', () => {
  const s1 = schoolService.getAllSchools().find(s => s.code === 'TZ-SCH-001');
  const s2 = schoolService.getAllSchools().find(s => s.code === 'TZ-SCH-002');
  const s1Form1 = db.get(`SELECT id FROM classes WHERE school_id = ? AND form_level = 1`, [s1.id]);
  const s2Stream = db.get(`SELECT id FROM streams WHERE school_id = ? LIMIT 1`, [s2.id]);

  assert.throws(() => {
    studentService.createStudent(s1.id, {
      regNumber: 'S1042/TEST/CROSSSCHOOL',
      firstName: 'Cross',
      lastName: 'School',
      gender: 'M',
      classId: s1Form1.id,
      streamId: s2Stream.id // Belonging to School 2!
    });
  }, /Invalid stream/);
});

runTest('Student registration with valid Form and Stream saves correctly in database', () => {
  const school = schoolService.getAllSchools().find(s => s.code === 'TZ-SCH-001');
  const form2 = db.get(`SELECT id FROM classes WHERE school_id = ? AND form_level = 2`, [school.id]);
  const streamB = db.get(`SELECT id, name FROM streams WHERE school_id = ? AND class_id = ? AND name = 'Stream B'`, [school.id, form2.id]);
  assert.ok(streamB, 'Stream B must exist for Form 2');

  const regNum = `S1042/REG/VALID_${Date.now()}`;
  const created = studentService.createStudent(school.id, {
    regNumber: regNum,
    firstName: 'Upendo',
    middleName: 'Joseph',
    lastName: 'Mrema',
    gender: 'F',
    classId: form2.id,
    streamId: streamB.id,
    parentName: 'Joseph Mrema',
    parentPhone: '+255 754 999 888'
  });

  assert.strictEqual(created.reg_number, regNum);
  assert.strictEqual(created.current_class_id, form2.id);
  assert.strictEqual(created.current_stream_id, streamB.id);
  assert.strictEqual(created.class_name, 'Form 2');
  assert.strictEqual(created.stream_name, 'Stream B');

  // Verify enrollment record
  const enrollment = db.get(
    `SELECT * FROM student_enrollments WHERE student_id = ? AND school_id = ?`,
    [created.id, school.id]
  );
  assert.ok(enrollment, 'Enrollment record must be created');
  assert.strictEqual(enrollment.class_id, form2.id);
  assert.strictEqual(enrollment.stream_id, streamB.id);
});

runTest('Support streams such as A, B, C, D and configurable stream names', () => {
  const school = schoolService.getAllSchools().find(s => s.code === 'TZ-SCH-001');
  const form3 = db.get(`SELECT id FROM classes WHERE school_id = ? AND form_level = 3`, [school.id]);

  // Check streams for Form 3
  const streams = academicService.getStreams(school.id, form3.id);
  const streamNames = streams.map(s => s.name);
  assert.ok(streamNames.includes('Stream A'), 'Missing Stream A');
  assert.ok(streamNames.includes('Stream B'), 'Missing Stream B');
  assert.ok(streamNames.includes('Stream C'), 'Missing Stream C');
  assert.ok(streamNames.includes('Stream D'), 'Missing Stream D');

  // Add configurable custom stream e.g., 'Commercial Stream'
  const customStream = academicService.createStream(school.id, form3.id, 'Commercial Stream');
  assert.strictEqual(customStream.name, 'Commercial Stream');
  assert.strictEqual(customStream.class_id, form3.id);

  // Verify student can be allocated to this custom stream
  const customStudent = studentService.createStudent(school.id, {
    regNumber: `S1042/COMM/${Date.now()}`,
    firstName: 'Salim',
    lastName: 'Juma',
    gender: 'M',
    classId: form3.id,
    streamId: customStream.id
  });
  assert.strictEqual(customStudent.stream_name, 'Commercial Stream');
});

runTest('Authorized user can edit student stream allocation', () => {
  const school = schoolService.getAllSchools().find(s => s.code === 'TZ-SCH-001');
  const student = db.get(`SELECT * FROM students WHERE school_id = ? LIMIT 1`, [school.id]);
  assert.ok(student, 'Student required to test stream update');

  // Find another stream in the same class
  const otherStream = db.get(
    `SELECT id, name FROM streams WHERE school_id = ? AND class_id = ? AND id != ? LIMIT 1`,
    [school.id, student.current_class_id, student.current_stream_id || 0]
  );
  assert.ok(otherStream, 'Another stream in the same class must exist');

  const updated = studentService.updateStudent(school.id, student.id, {
    streamId: otherStream.id
  });

  assert.strictEqual(updated.current_stream_id, otherStream.id);
  assert.strictEqual(updated.stream_name, otherStream.name);

  // Verify active enrollment was updated
  const en = db.get(
    `SELECT stream_id FROM student_enrollments WHERE student_id = ? AND school_id = ? ORDER BY id DESC LIMIT 1`,
    [student.id, school.id]
  );
  assert.strictEqual(en.stream_id, otherStream.id);
});

runTest('API Integration: POST /api/students saves Stream and returns student with stream_name', async () => {
  const school = schoolService.getAllSchools().find(s => s.code === 'TZ-SCH-001');
  const form1 = db.get(`SELECT id FROM classes WHERE school_id = ? AND form_level = 1`, [school.id]);
  const streamA = db.get(`SELECT id FROM streams WHERE school_id = ? AND class_id = ? AND name = 'Stream A'`, [school.id, form1.id]);

  const postRes = await mockApiCall('POST', '/api/students', {}, {
    schoolId: school.id,
    regNumber: `S1042/API/${Date.now()}`,
    firstName: 'Fatma',
    lastName: 'Kassimu',
    gender: 'F',
    classId: form1.id,
    streamId: streamA.id
  });

  assert.strictEqual(postRes.status, 201);
  assert.strictEqual(postRes.data.success, true);
  assert.strictEqual(postRes.data.student.class_name, 'Form 1');
  assert.strictEqual(postRes.data.student.stream_name, 'Stream A');

  // Verify stream edit via PUT /api/students/:id
  const streamC = db.get(`SELECT id FROM streams WHERE school_id = ? AND class_id = ? AND name = 'Stream C'`, [school.id, form1.id]);
  const putRes = await mockApiCall('PUT', `/api/students/${postRes.data.student.id}`, {}, {
    schoolId: school.id,
    streamId: streamC.id
  });

  assert.strictEqual(putRes.status, 200);
  assert.strictEqual(putRes.data.student.stream_name, 'Stream C');
});

runTest('API Integration: POST /api/students without STREAM returns HTTP 400 error', async () => {
  const school = schoolService.getAllSchools().find(s => s.code === 'TZ-SCH-001');
  const form1 = db.get(`SELECT id FROM classes WHERE school_id = ? AND form_level = 1`, [school.id]);

  const postRes = await mockApiCall('POST', '/api/students', {}, {
    schoolId: school.id,
    regNumber: `S1042/API/FAIL_${Date.now()}`,
    firstName: 'NoStream',
    lastName: 'Fail',
    gender: 'M',
    classId: form1.id,
    streamId: null
  });

  assert.strictEqual(postRes.status, 400);
  assert.ok(postRes.data.error.includes('STREAM is required'));
});

// 7. Teacher & Staff Module Tests
console.log('\n--- 7. TEACHER & STAFF MODULE ---');

runTest('Automatic Username Generation: extracts first and last name in uppercase without spaces', () => {
  const u1 = teacherService.generateUniqueUsername('JULIUS SOMALIA IMELI');
  assert.strictEqual(u1, 'JULIUSIMELI');

  const u2 = teacherService.generateUniqueUsername('Mwl. Peter Massawe');
  assert.strictEqual(u2, 'PETERMASSAWE');

  const u3 = teacherService.generateUniqueUsername('Asha Rashid');
  assert.strictEqual(u3, 'ASHARASHID');
});

runTest('Duplicate Username Handling: appends sequential number to guarantee uniqueness', () => {
  const school = schoolService.getAllSchools()[0];

  // Create a teacher with username TESTUSER
  const t1 = teacherService.createTeacher(school.id, {
    fullName: 'Test User Alpha',
    gender: 'M',
    username: 'TESTUSERDUP'
  });
  assert.strictEqual(t1.username, 'TESTUSERDUP');

  // Attempting to generate username for another teacher with the same base name
  const nextUsername = teacherService.generateUniqueUsername('Test Alpha Userdup', school.id);
  assert.strictEqual(nextUsername, 'TESTUSERDUP1');

  // Create second teacher with that base name
  const t2 = teacherService.createTeacher(school.id, {
    fullName: 'Test Duplicate Userdup',
    gender: 'F',
    username: 'TESTUSERDUP' // Should auto-resolve to unique
  });
  assert.strictEqual(t2.username, 'TESTUSERDUP1');

  // Next candidate should be TESTUSERDUP2
  const nextCandidate = teacherService.generateUniqueUsername('Test Duplicate Userdup', school.id);
  assert.strictEqual(nextCandidate, 'TESTUSERDUP2');
});

runTest('Teacher Registration: saves teacher without requiring email, qualification, or TS number', () => {
  const school = schoolService.getAllSchools()[0];
  const teacher = teacherService.createTeacher(school.id, {
    fullName: 'JULIUS SOMALIA IMELI',
    gender: 'M',
    phone: '+255 754 000 888'
  });

  assert.ok(teacher.id > 0, 'Teacher must have valid ID');
  assert.strictEqual(teacher.first_name, 'JULIUS');
  assert.strictEqual(teacher.last_name, 'SOMALIA IMELI');
  assert.strictEqual(teacher.gender, 'M');
  assert.strictEqual(teacher.phone, '+255 754 000 888');
  assert.strictEqual(teacher.username.startsWith('JULIUSIMELI'), true);

  // Verify internal staff_id was generated without compulsory TS format
  assert.ok(teacher.staff_id.startsWith('TCH-'));

  // Verify User record was created in users table
  const user = db.get(`SELECT * FROM users WHERE id = ?`, [teacher.user_id]);
  assert.ok(user, 'User login record must exist');
  assert.strictEqual(user.username, teacher.username);
  assert.strictEqual(user.role, 'TEACHER');
});

runTest('Subject & Class Allocations: records multiple subjects and multiple classes/streams', () => {
  const school = schoolService.getAllSchools()[0];
  const subjects = academicService.getSubjects(school.id);
  const classes = academicService.getClassesWithStreams(school.id);

  assert.ok(subjects.length >= 2, 'Need at least 2 subjects');
  assert.ok(classes.length >= 2, 'Need at least 2 classes');

  const sub1 = subjects[0];
  const sub2 = subjects[1];
  const c1 = classes[0];
  const c2 = classes[1];
  const stream1 = c1.streams[0];
  const stream2 = c2.streams[0];

  const teacher = teacherService.createTeacher(school.id, {
    fullName: 'Rehema Kassim Bakari',
    gender: 'F',
    phone: '+255 718 222 333',
    subjectIds: [sub1.id, sub2.id],
    classAllocations: [
      `${c1.id}_${stream1 ? stream1.id : 0}`,
      `${c2.id}_${stream2 ? stream2.id : 0}`
    ]
  });

  assert.ok(teacher.subjects.length >= 2, 'Teacher must have multiple subjects');
  assert.ok(teacher.assignedClasses.length >= 2, 'Teacher must have multiple assigned classes');

  // Verify allocations in database
  const allocs = db.all(`SELECT * FROM teacher_allocations WHERE teacher_id = ?`, [teacher.id]);
  assert.ok(allocs.length >= 2, 'Database allocations must exist');
});

runTest('Teacher Directory Query: returns sequential S/N, full name, gender, subjects, classes, phone, username', () => {
  const school = schoolService.getAllSchools()[0];
  const teachers = teacherService.getTeachers(school.id);

  assert.ok(teachers.length > 0, 'Teachers list must not be empty');

  // Check sequential S/N
  teachers.forEach((t, idx) => {
    assert.strictEqual(t.sn, idx + 1, `Teacher S/N must be ordinary sequential number ${idx + 1}`);
    assert.ok(t.fullName, 'Teacher must have full name');
    assert.ok(['M', 'F'].includes(t.gender), 'Teacher must have gender M or F');
    assert.ok(Array.isArray(t.subjects), 'Teacher subjects must be an array');
    assert.ok(Array.isArray(t.assignedClasses), 'Teacher assignedClasses must be an array');
    assert.ok(t.username, 'Teacher must have login username');
  });
});

runTest('Teacher Update & Delete: allows modifying records and deleting safely', () => {
  const school = schoolService.getAllSchools()[0];
  const teacher = teacherService.createTeacher(school.id, {
    fullName: 'Temporary Test Teacher',
    gender: 'M',
    phone: '+255 700 000 000'
  });

  // Update
  const updated = teacherService.updateTeacher(school.id, teacher.id, {
    fullName: 'Updated Name Teacher',
    gender: 'M',
    phone: '+255 711 111 111'
  });

  assert.strictEqual(updated.first_name, 'Updated');
  assert.strictEqual(updated.last_name, 'Name Teacher');
  assert.strictEqual(updated.phone, '+255 711 111 111');

  // Delete
  const delRes = teacherService.deleteTeacher(school.id, teacher.id);
  assert.strictEqual(delRes.success, true);
  const check = teacherService.getTeacherById(school.id, teacher.id);
  assert.strictEqual(check, null);
});

runTest('API Integration: GET /api/teachers/generate-username generates unique username', async () => {
  const res = await mockApiCall('GET', '/api/teachers/generate-username', { name: 'JULIUS SOMALIA IMELI' });
  assert.strictEqual(res.status, 200);
  assert.ok(res.data.username.startsWith('JULIUSIMELI'));
});

runTest('API Integration: POST /api/teachers creates teacher and returns HTTP 201', async () => {
  const school = schoolService.getAllSchools()[0];
  const postRes = await mockApiCall('POST', '/api/teachers', {}, {
    schoolId: school.id,
    fullName: 'API Registered Teacher',
    gender: 'F',
    phone: '+255 765 432 100'
  });

  assert.strictEqual(postRes.status, 201);
  assert.strictEqual(postRes.data.success, true);
  assert.strictEqual(postRes.data.teacher.gender, 'F');
  assert.ok(postRes.data.teacher.username);
});

console.log('\n================================================================');
console.log(` TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('================================================================');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
