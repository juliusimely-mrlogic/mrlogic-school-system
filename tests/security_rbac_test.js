process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'isolated-security-test-secret-material-32-bytes-minimum';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../db/database');
const authService = require('../services/authService');
const { handleApiRequest } = require('../routes/api');
const teacherService = require('../services/teacherService');

const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
db.exec(schema);

let passed = 0;
let failed = 0;

async function test(name, run) {
  try {
    await run();
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (error) {
    failed++;
    console.error(`[FAIL] ${name}: ${error.message}`);
  }
}

function insert(sql, params) {
  return db.run(sql, params).lastInsertRowid;
}

function createSchool(code, name) {
  const schoolId = insert(
    `INSERT INTO schools (code, name, region, district) VALUES (?, ?, 'Test Region', 'Test District')`,
    [code, name]
  );
  const yearId = insert(
    `INSERT INTO academic_years (school_id, year_label, is_current) VALUES (?, '2026', 1)`,
    [schoolId]
  );
  const termId = insert(
    `INSERT INTO academic_terms (school_id, academic_year_id, term_name, is_current)
     VALUES (?, ?, 'Term 1', 1)`,
    [schoolId, yearId]
  );
  const classId = insert(
    `INSERT INTO classes (school_id, form_level, name, numeric_order) VALUES (?, 1, 'Form 1', 1)`,
    [schoolId]
  );
  const streamAId = insert(
    `INSERT INTO streams (school_id, class_id, name) VALUES (?, ?, 'Stream A')`,
    [schoolId, classId]
  );
  const streamBId = insert(
    `INSERT INTO streams (school_id, class_id, name) VALUES (?, ?, 'Stream B')`,
    [schoolId, classId]
  );
  const mathId = insert(
    `INSERT INTO subjects (school_id, code, name) VALUES (?, 'MATH', 'Mathematics')`,
    [schoolId]
  );
  const englishId = insert(
    `INSERT INTO subjects (school_id, code, name) VALUES (?, 'ENG', 'English')`,
    [schoolId]
  );
  const gradingSystemId = insert(
    `INSERT INTO grading_systems (school_id, name) VALUES (?, 'Test grading')`,
    [schoolId]
  );
  const examId = insert(
    `INSERT INTO examinations
     (school_id, academic_year_id, term_id, class_id, name, exam_type, grading_system_id)
     VALUES (?, ?, ?, ?, 'Test exam', 'MIDTERM', ?)`,
    [schoolId, yearId, termId, classId, gradingSystemId]
  );
  return {
    schoolId,
    yearId,
    termId,
    classId,
    streamAId,
    streamBId,
    mathId,
    englishId,
    gradingSystemId,
    examId
  };
}

function createUser(role, schoolId, username) {
  const credential = authService.hashPassword(`test-only-${username}`);
  return insert(
    `INSERT INTO users (school_id, full_name, email, username, password_hash, salt, role)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      schoolId,
      `Test ${username}`,
      `${username}@example.invalid`,
      username,
      credential.hash,
      credential.salt,
      role
    ]
  );
}

function createStudent(school, streamId, regNumber) {
  return insert(
    `INSERT INTO students
     (school_id, reg_number, first_name, last_name, gender, current_class_id, current_stream_id)
     VALUES (?, ?, 'Test', 'Student', 'F', ?, ?)`,
    [school.schoolId, regNumber, school.classId, streamId]
  );
}

const schoolA = createSchool('TEST-A', 'Test School A');
const schoolB = createSchool('TEST-B', 'Test School B');
const schoolAStudentA = createStudent(schoolA, schoolA.streamAId, 'A-STREAM-A');
const schoolAStudentB = createStudent(schoolA, schoolA.streamBId, 'A-STREAM-B');
const schoolBStudent = createStudent(schoolB, schoolB.streamAId, 'B-STREAM-A');

const superAdminId = createUser('SUPER_ADMIN', null, 'test-super-admin');
const schoolAdminId = createUser('SCHOOL_ADMIN', schoolA.schoolId, 'test-school-admin');
const otherSchoolAdminId = createUser('SCHOOL_ADMIN', schoolB.schoolId, 'test-other-school-admin');
const academicMasterId = createUser('ACADEMIC_MASTER', schoolA.schoolId, 'test-academic-master');
const teacherUserId = createUser('TEACHER', schoolA.schoolId, 'test-teacher');
const teacherId = insert(
  `INSERT INTO teachers (school_id, user_id, staff_id, first_name, last_name, gender)
   VALUES (?, ?, 'TEST-TCH-1', 'Test', 'Teacher', 'F')`,
  [schoolA.schoolId, teacherUserId]
);
insert(
  `INSERT INTO teacher_allocations
   (school_id, teacher_id, subject_id, class_id, stream_id, academic_year_id)
   VALUES (?, ?, ?, ?, ?, ?)`,
  [schoolA.schoolId, teacherId, schoolA.mathId, schoolA.classId, schoolA.streamAId, schoolA.yearId]
);

const schoolAAdminTeacher = teacherService.createTeacher(schoolA.schoolId, {
  fullName: 'Test School Admin Managed Teacher',
  gender: 'M',
  password: 'isolated-test-password'
});
const protectedTeacherId = insert(
  `INSERT INTO teachers (school_id, user_id, staff_id, first_name, last_name, gender)
   VALUES (?, ?, 'TEST-LINKED-SUPER', 'Protected', 'Account', 'M')`,
  [schoolA.schoolId, superAdminId]
);

const users = {
  superAdmin: { id: superAdminId, role: 'SUPER_ADMIN' },
  schoolAdmin: { id: schoolAdminId, role: 'SCHOOL_ADMIN' },
  otherSchoolAdmin: { id: otherSchoolAdminId, role: 'SCHOOL_ADMIN' },
  academicMaster: { id: academicMasterId, role: 'ACADEMIC_MASTER' },
  teacher: { id: teacherUserId, role: 'TEACHER' }
};

let schoolAdminCreatedStudentId;
let academicMasterCreatedExamId;

function apiCall(user, method, pathname, query = {}, body = {}, extraHeaders = {}) {
  const token = user
    ? authService.generateToken({ userId: user.id, role: user.role })
    : null;
  const req = {
    method,
    url: pathname,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extraHeaders
    }
  };
  let status = 200;
  let responseBody = '';
  const res = {
    writeHead(code) {
      status = code;
    },
    end(data) {
      responseBody = data || '';
    }
  };
  handleApiRequest(req, res, pathname, query, body);
  return {
    status,
    data: responseBody ? JSON.parse(responseBody) : null
  };
}

async function run() {
  await test('Protected API routes reject missing authentication', () => {
    assert.equal(apiCall(null, 'GET', '/api/students').status, 401);
  });

  await test('SUPER_ADMIN retains global school and cross-school data access', () => {
    const schools = apiCall(users.superAdmin, 'GET', '/api/schools');
    assert.equal(schools.status, 200);
    assert.equal(schools.data.schools.length, 2);

    const students = apiCall(users.superAdmin, 'GET', '/api/students', {
      school_id: String(schoolB.schoolId)
    });
    assert.equal(students.status, 200);
    assert.equal(students.data.students.length, 1);
    assert.equal(students.data.students[0].id, schoolBStudent);
  });

  await test('SCHOOL_ADMIN can read and create records in their own school', () => {
    const ownStudents = apiCall(users.schoolAdmin, 'GET', '/api/students');
    assert.equal(ownStudents.status, 200);
    assert.equal(ownStudents.data.students.length, 2);

    const created = apiCall(users.schoolAdmin, 'POST', '/api/students', {}, {
      regNumber: 'A-NEW',
      firstName: 'New',
      lastName: 'Student',
      gender: 'M',
      classId: schoolA.classId,
      streamId: schoolA.streamAId
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.student.school_id, schoolA.schoolId);
    schoolAdminCreatedStudentId = created.data.student.id;
  });

  await test('SCHOOL_ADMIN cannot select another school by query, body, header, or URL', () => {
    assert.equal(apiCall(users.schoolAdmin, 'GET', '/api/students', {
      school_id: String(schoolB.schoolId)
    }).status, 403);
    assert.equal(apiCall(users.schoolAdmin, 'POST', '/api/students', {}, {
      schoolId: schoolB.schoolId
    }).status, 403);
    assert.equal(apiCall(users.schoolAdmin, 'GET', '/api/students', {}, {}, {
      'x-school-id': String(schoolB.schoolId)
    }).status, 403);
    assert.equal(apiCall(users.schoolAdmin, 'GET', `/api/schools/${schoolB.schoolId}`).status, 403);
    assert.equal(apiCall(users.schoolAdmin, 'GET', '/api/exams', {
      school_id: String(schoolB.schoolId)
    }).status, 403);
  });

  await test('SCHOOL_ADMIN cannot change a teacher account role or use teacher routes to modify SUPER_ADMIN', () => {
    const changeRole = apiCall(users.schoolAdmin, 'PUT', `/api/teachers/${schoolAAdminTeacher.id}`, {}, {
      role: 'SUPER_ADMIN'
    });
    assert.equal(changeRole.status, 200);
    assert.equal(db.get(`SELECT role FROM users WHERE id = ?`, [schoolAAdminTeacher.user_id]).role, 'TEACHER');

    const superBefore = db.get(`SELECT full_name, role FROM users WHERE id = ?`, [superAdminId]);
    assert.equal(apiCall(users.schoolAdmin, 'PUT', `/api/teachers/${protectedTeacherId}`, {}, {
      firstName: 'Changed'
    }).status, 400);
    assert.equal(apiCall(users.schoolAdmin, 'DELETE', `/api/teachers/${protectedTeacherId}`).status, 400);
    assert.deepEqual(db.get(`SELECT full_name, role FROM users WHERE id = ?`, [superAdminId]), superBefore);
  });

  await test('ACADEMIC_MASTER can read and manage academic operations in their school only', () => {
    assert.equal(apiCall(users.academicMaster, 'GET', '/api/academics/years').status, 200);
    assert.equal(apiCall(users.academicMaster, 'GET', '/api/academics/terms').status, 200);
    assert.equal(apiCall(users.academicMaster, 'GET', '/api/academics/classes').status, 200);
    assert.equal(apiCall(users.academicMaster, 'POST', '/api/academics/streams', {}, {
      classId: schoolA.classId,
      name: 'Stream C'
    }).status, 201);
    const exam = apiCall(users.academicMaster, 'POST', '/api/exams', {}, {
      academicYearId: schoolA.yearId,
      termId: schoolA.termId,
      classId: schoolA.classId,
      name: 'Academic Master Exam',
      examType: 'MIDTERM'
    });
    assert.equal(exam.status, 201);
    academicMasterCreatedExamId = exam.data.exam.id;
    assert.equal(apiCall(users.academicMaster, 'POST', '/api/students', {}, {}).status, 403);
    assert.equal(apiCall(users.academicMaster, 'POST', '/api/teachers', {}, {}).status, 403);
    assert.equal(apiCall(users.academicMaster, 'GET', '/api/schools').status, 403);
    assert.equal(apiCall(users.academicMaster, 'GET', '/api/academics/classes', {
      school_id: String(schoolB.schoolId)
    }).status, 403);
  });

  await test('TEACHER reads only assigned academic years, classes, streams, subjects, and exams', () => {
    const years = apiCall(users.teacher, 'GET', '/api/academics/years');
    assert.equal(years.status, 200);
    assert.deepEqual(years.data.years.map(year => year.id), [schoolA.yearId]);

    const classes = apiCall(users.teacher, 'GET', '/api/academics/classes');
    assert.equal(classes.status, 200);
    assert.deepEqual(classes.data.classes.map(item => item.id), [schoolA.classId]);
    assert.deepEqual(classes.data.classes[0].streams.map(stream => stream.id), [schoolA.streamAId]);

    const subjects = apiCall(users.teacher, 'GET', '/api/academics/subjects');
    assert.equal(subjects.status, 200);
    assert.deepEqual(subjects.data.subjects.map(subject => subject.id), [schoolA.mathId]);

    const exams = apiCall(users.teacher, 'GET', '/api/exams');
    assert.equal(exams.status, 200);
    assert.deepEqual(
      exams.data.exams.map(exam => exam.id).sort((a, b) => a - b),
      [schoolA.examId, academicMasterCreatedExamId].sort((a, b) => a - b)
    );
    assert.equal(exams.data.exams[0].total_class_students, null);
    assert.equal(apiCall(users.teacher, 'GET', '/api/academics/subjects', {
      school_id: String(schoolB.schoolId)
    }).status, 403);
  });

  await test('TEACHER cannot manage students, teachers, exams, streams, or global dashboards', () => {
    assert.equal(apiCall(users.teacher, 'GET', '/api/students').status, 403);
    assert.equal(apiCall(users.teacher, 'GET', '/api/teachers').status, 403);
    assert.equal(apiCall(users.teacher, 'POST', '/api/teachers', {}, {}).status, 403);
    assert.equal(apiCall(users.teacher, 'POST', '/api/exams', {}, {}).status, 403);
    assert.equal(apiCall(users.teacher, 'POST', `/api/exams/${schoolA.examId}/process`).status, 403);
    assert.equal(apiCall(users.teacher, 'POST', '/api/academics/streams', {}, {}).status, 403);
    assert.equal(apiCall(users.teacher, 'GET', '/api/dashboard').status, 403);
    assert.equal(apiCall({ id: teacherUserId, role: 'SUPER_ADMIN' }, 'GET', '/api/schools').status, 403);
  });

  await test('TEACHER can read and enter marks only for assigned subject, class, and stream', () => {
    const sheet = apiCall(users.teacher, 'GET', `/api/exams/${schoolA.examId}/marks`, {
      subject_id: String(schoolA.mathId)
    });
    assert.equal(sheet.status, 200);
    assert.deepEqual(
      sheet.data.students.map(student => student.student_id).sort((a, b) => a - b),
      [schoolAStudentA, schoolAdminCreatedStudentId].sort((a, b) => a - b)
    );

    const unassignedSheet = apiCall(users.teacher, 'GET', `/api/exams/${schoolA.examId}/marks`, {
      subject_id: String(schoolA.englishId)
    });
    assert.equal(unassignedSheet.status, 400);

    const saved = apiCall(users.teacher, 'POST', `/api/exams/${schoolA.examId}/marks`, {}, {
      subjectId: schoolA.mathId,
      marks: [{ studentId: schoolAStudentA, marks: 82 }]
    });
    assert.equal(saved.status, 200);
    assert.equal(db.get(
      `SELECT marks FROM exam_marks WHERE examination_id = ? AND student_id = ? AND subject_id = ?`,
      [schoolA.examId, schoolAStudentA, schoolA.mathId]
    ).marks, 82);

    assert.equal(apiCall(users.teacher, 'POST', `/api/exams/${schoolA.examId}/marks`, {}, {
      subjectId: schoolA.englishId,
      marks: [{ studentId: schoolAStudentA, marks: 70 }]
    }).status, 400);
    assert.equal(apiCall(users.teacher, 'POST', `/api/exams/${schoolA.examId}/marks`, {}, {
      subjectId: schoolA.mathId,
      marks: [{ studentId: schoolAStudentB, marks: 70 }]
    }).status, 400);
    assert.equal(apiCall(users.teacher, 'POST', `/api/exams/${schoolA.examId}/marks`, {}, {
      subjectId: schoolA.mathId,
      marks: [{ studentId: schoolBStudent, marks: 70 }]
    }).status, 400);
    assert.equal(apiCall(users.teacher, 'GET', `/api/exams/${schoolA.examId}/marks`, {
      subject_id: String(schoolA.mathId),
      stream_id: String(schoolA.streamBId)
    }).status, 400);
  });

  await test('TEACHER reports contain assigned academic data only', () => {
    const savedMark = apiCall(users.teacher, 'POST', `/api/exams/${schoolA.examId}/marks`, {}, {
      subjectId: schoolA.mathId,
      marks: [{ studentId: schoolAStudentA, marks: 82 }]
    });
    assert.equal(savedMark.status, 200);

    for (const studentId of [schoolAStudentA, schoolAStudentB]) {
      insert(
        `INSERT INTO exam_processed_results
         (school_id, examination_id, student_id, division, class_rank, stream_rank)
         VALUES (?, ?, ?, 'II', 1, 1)`,
        [schoolA.schoolId, schoolA.examId, studentId]
      );
    }

    const card = apiCall(
      users.teacher,
      'GET',
      `/api/reports/report-card/${schoolA.examId}/${schoolAStudentA}`
    );
    assert.equal(card.status, 200);
    assert.equal(card.data.summary, null);
    assert.equal(card.data.student.parent_phone, undefined);
    assert.deepEqual(card.data.marks.map(mark => mark.subject_id), [schoolA.mathId]);

    const outsideStudentCard = apiCall(
      users.teacher,
      'GET',
      `/api/reports/report-card/${schoolA.examId}/${schoolAStudentB}`
    );
    assert.equal(outsideStudentCard.status, 400);

    const broadsheet = apiCall(users.teacher, 'GET', `/api/reports/broadsheet/${schoolA.examId}`);
    assert.equal(broadsheet.status, 200);
    assert.deepEqual(broadsheet.data.subjects.map(subject => subject.id), [schoolA.mathId]);
    assert.deepEqual(broadsheet.data.rows.map(row => row.studentId), [schoolAStudentA]);
    assert.equal(broadsheet.data.rows[0].division, undefined);

    const analysis = apiCall(users.teacher, 'GET', `/api/reports/subject-analysis/${schoolA.examId}`);
    assert.equal(analysis.status, 200);
    assert.deepEqual(analysis.data.subjects.map(subject => subject.id), [schoolA.mathId]);
  });

  await test('Malformed routes cannot fall through to prefix handlers', () => {
    assert.equal(apiCall(users.schoolAdmin, 'GET', `/api/students/${schoolAStudentA}/extra`).status, 404);
  });

  console.log(`\nSecurity RBAC tests: ${passed} passed, ${failed} failed (in-memory SQLite only).`);
  db.close();
  if (failed > 0) process.exitCode = 1;
}

run().catch(error => {
  console.error(`[FAIL] Security suite aborted: ${error.message}`);
  db.close();
  process.exitCode = 1;
});
