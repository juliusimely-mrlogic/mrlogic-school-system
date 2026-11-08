/**
 * MR LOGIC SCHOOL SYSTEM - Student Management Service
 */
const db = require('../db/database');

function getStudents(schoolId, options = {}) {
  const {
    classId,
    streamId,
    gender,
    status = 'ACTIVE',
    search = '',
    limit = 50,
    offset = 0
  } = options;

  let sql = `
    SELECT s.*, 
           c.name as class_name, 
           c.form_level,
           st.name as stream_name
    FROM students s
    JOIN classes c ON s.current_class_id = c.id AND c.school_id = s.school_id
    LEFT JOIN streams st ON s.current_stream_id = st.id
      AND st.school_id = s.school_id AND st.class_id = s.current_class_id
    WHERE s.school_id = ?
  `;
  const params = [schoolId];

  if (classId) {
    sql += ` AND s.current_class_id = ?`;
    params.push(classId);
  }

  if (streamId) {
    sql += ` AND s.current_stream_id = ?`;
    params.push(streamId);
  }

  if (gender) {
    sql += ` AND s.gender = ?`;
    params.push(gender);
  }

  if (status) {
    sql += ` AND s.status = ?`;
    params.push(status);
  }

  if (search && search.trim() !== '') {
    const term = `%${search.trim()}%`;
    sql += ` AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.reg_number LIKE ? OR s.middle_name LIKE ?)`;
    params.push(term, term, term, term);
  }

  // Count total matching
  const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
  const countRow = db.get(countSql, params);
  const total = countRow ? countRow.total : 0;

  // Add order and pagination
  sql += ` ORDER BY c.form_level ASC, st.name ASC, s.last_name ASC, s.first_name ASC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const students = db.all(sql, params);

  return {
    total,
    limit,
    offset,
    students
  };
}

function getStudentById(schoolId, studentId) {
  const student = db.get(
    `SELECT s.*, 
            c.name as class_name, 
            c.form_level,
            st.name as stream_name,
            sch.name as school_name
     FROM students s
     JOIN schools sch ON s.school_id = sch.id
     JOIN classes c ON s.current_class_id = c.id AND c.school_id = s.school_id
     LEFT JOIN streams st ON s.current_stream_id = st.id
       AND st.school_id = s.school_id AND st.class_id = s.current_class_id
     WHERE s.id = ? AND s.school_id = ?`,
    [studentId, schoolId]
  );

  if (!student) return null;

  // Fetch academic history (enrollments)
  const enrollments = db.all(
    `SELECT se.*, y.year_label, c.name as class_name, st.name as stream_name
     FROM student_enrollments se
     JOIN academic_years y ON se.academic_year_id = y.id AND y.school_id = se.school_id
     JOIN classes c ON se.class_id = c.id AND c.school_id = se.school_id
     LEFT JOIN streams st ON se.stream_id = st.id
       AND st.school_id = se.school_id AND st.class_id = se.class_id
     WHERE se.student_id = ? AND se.school_id = ?
     ORDER BY y.year_label DESC`,
    [studentId, schoolId]
  );

  // Fetch examination records
  const examResults = db.all(
    `SELECT r.*, e.name as exam_name, e.exam_type, y.year_label, t.term_name
     FROM exam_processed_results r
     JOIN examinations e ON r.examination_id = e.id AND e.school_id = r.school_id
     JOIN academic_years y ON e.academic_year_id = y.id AND y.school_id = e.school_id
     JOIN academic_terms t ON e.term_id = t.id AND t.school_id = e.school_id
     WHERE r.student_id = ? AND r.school_id = ?
     ORDER BY e.created_at DESC`,
    [studentId, schoolId]
  );

  return {
    ...student,
    enrollments,
    examResults
  };
}

function createStudent(schoolId, data) {
  const {
    regNumber,
    firstName,
    middleName,
    lastName,
    gender,
    dateOfBirth,
    admissionDate,
    classId,
    streamId,
    parentName,
    parentPhone
  } = data;

  if (!regNumber || !firstName || !lastName || !gender || !classId) {
    throw new Error('Registration number, first name, last name, gender, and Form/Class are required.');
  }

  // 1. Verify Class belongs to this school
  const classRecord = db.get(
    `SELECT * FROM classes WHERE id = ? AND school_id = ?`,
    [classId, schoolId]
  );
  if (!classRecord) {
    throw new Error('Invalid class: Class does not exist or does not belong to this school.');
  }

  // 2. Requirement: STREAM is a required field
  if (!streamId) {
    throw new Error('STREAM is required. Please select a valid stream belonging to the selected Form.');
  }

  // 3. Verify Stream belongs to this school AND to the selected class
  const streamRecord = db.get(
    `SELECT * FROM streams WHERE id = ? AND school_id = ?`,
    [streamId, schoolId]
  );
  if (!streamRecord) {
    throw new Error('Invalid stream: The selected stream does not exist or does not belong to this school.');
  }

  if (streamRecord.class_id !== parseInt(classId, 10)) {
    throw new Error(`Stream mismatch: The selected stream (${streamRecord.name}) does not belong to ${classRecord.name}.`);
  }

  // 4. Check for duplicate registration number in this school
  const existingReg = db.get(
    `SELECT id FROM students WHERE reg_number = ? AND school_id = ?`,
    [regNumber.trim(), schoolId]
  );
  if (existingReg) {
    throw new Error(`A student with registration number "${regNumber.trim()}" already exists in this school.`);
  }

  const currentYear = db.get(
    `SELECT id FROM academic_years WHERE school_id = ? AND is_current = 1 LIMIT 1`,
    [schoolId]
  );

  const res = db.run(
    `INSERT INTO students (
       school_id, reg_number, first_name, middle_name, last_name, 
       gender, date_of_birth, admission_date, current_class_id, current_stream_id,
       parent_name, parent_phone, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    [
      schoolId,
      regNumber.trim(),
      firstName.trim(),
      middleName ? middleName.trim() : null,
      lastName.trim(),
      gender,
      dateOfBirth || null,
      admissionDate || new Date().toISOString().split('T')[0],
      parseInt(classId, 10),
      parseInt(streamId, 10),
      parentName ? parentName.trim() : null,
      parentPhone ? parentPhone.trim() : null
    ]
  );

  const studentId = res.lastInsertRowid;

  // Auto-enroll in current academic year if active
  if (currentYear) {
    db.run(
      `INSERT INTO student_enrollments (school_id, student_id, academic_year_id, class_id, stream_id, status)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
      [schoolId, studentId, currentYear.id, parseInt(classId, 10), parseInt(streamId, 10)]
    );
  }

  return getStudentById(schoolId, studentId);
}

function updateStudent(schoolId, studentId, data) {
  const student = db.get(
    `SELECT * FROM students WHERE id = ? AND school_id = ?`,
    [studentId, schoolId]
  );
  if (!student) {
    throw new Error('Student not found or unauthorized.');
  }

  const {
    regNumber,
    firstName,
    middleName,
    lastName,
    gender,
    dateOfBirth,
    classId,
    streamId,
    parentName,
    parentPhone,
    status
  } = data;

  const targetClassId = classId ? parseInt(classId, 10) : student.current_class_id;
  const targetStreamId = streamId !== undefined ? (streamId ? parseInt(streamId, 10) : null) : student.current_stream_id;

  const classRecord = db.get(
    `SELECT * FROM classes WHERE id = ? AND school_id = ?`,
    [targetClassId, schoolId]
  );
  if (!classRecord) {
    throw new Error('Invalid class: Class does not exist or does not belong to this school.');
  }

  // Validate stream if provided
  if (targetStreamId) {
    const streamRecord = db.get(
      `SELECT * FROM streams WHERE id = ? AND school_id = ? AND class_id = ?`,
      [targetStreamId, schoolId, targetClassId]
    );
    if (!streamRecord) {
      throw new Error('Invalid stream: The selected stream does not exist or does not belong to this school.');
    }
    if (streamRecord.class_id !== targetClassId) {
      throw new Error('Stream mismatch: The selected stream does not belong to the selected Form/Class.');
    }
  }

  // Validate uniqueness if regNumber changed
  if (regNumber && regNumber.trim() !== student.reg_number) {
    const dup = db.get(
      `SELECT id FROM students WHERE reg_number = ? AND school_id = ? AND id != ?`,
      [regNumber.trim(), schoolId, studentId]
    );
    if (dup) {
      throw new Error(`Registration number "${regNumber.trim()}" is already assigned to another student.`);
    }
  }

  db.run(
    `UPDATE students SET
       reg_number = COALESCE(?, reg_number),
       first_name = COALESCE(?, first_name),
       middle_name = COALESCE(?, middle_name),
       last_name = COALESCE(?, last_name),
       gender = COALESCE(?, gender),
       date_of_birth = COALESCE(?, date_of_birth),
       current_class_id = ?,
       current_stream_id = ?,
       parent_name = COALESCE(?, parent_name),
       parent_phone = COALESCE(?, parent_phone),
       status = COALESCE(?, status)
     WHERE id = ? AND school_id = ?`,
    [
      regNumber ? regNumber.trim() : null,
      firstName ? firstName.trim() : null,
      middleName !== undefined ? (middleName ? middleName.trim() : null) : null,
      lastName ? lastName.trim() : null,
      gender || null,
      dateOfBirth || null,
      targetClassId,
      targetStreamId,
      parentName !== undefined ? (parentName ? parentName.trim() : null) : null,
      parentPhone !== undefined ? (parentPhone ? parentPhone.trim() : null) : null,
      status || null,
      studentId,
      schoolId
    ]
  );

  // Update enrollment record for current year if present
  const currentYear = db.get(
    `SELECT id FROM academic_years WHERE school_id = ? AND is_current = 1 LIMIT 1`,
    [schoolId]
  );
  if (currentYear) {
    db.run(
      `UPDATE student_enrollments SET class_id = ?, stream_id = ? 
       WHERE school_id = ? AND student_id = ? AND academic_year_id = ?`,
      [targetClassId, targetStreamId, schoolId, studentId, currentYear.id]
    );
  }

  return getStudentById(schoolId, studentId);
}

module.exports = {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent
};
