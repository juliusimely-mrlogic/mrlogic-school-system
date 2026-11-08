/**
 * MR LOGIC SCHOOL SYSTEM - Examination Management Service
 */
const db = require('../db/database');
const { calculateGradeForMark, getGradingRulesForExam } = require('./gradingService');
const accessService = require('./accessService');

function getExaminations(schoolId, options = {}) {
  const { classId, academicYearId, teacherUserId } = options;

  let sql = `
    SELECT e.*, 
           c.name as class_name, 
           c.form_level,
           y.year_label, 
           t.term_name,
           gs.name as grading_system_name,
           (SELECT COUNT(DISTINCT m.student_id)
            FROM exam_marks m
            JOIN students s ON s.id = m.student_id AND s.school_id = m.school_id
            JOIN subjects sub ON sub.id = m.subject_id AND sub.school_id = m.school_id
            WHERE m.examination_id = e.id AND m.school_id = e.school_id
              AND s.current_class_id = e.class_id) as students_with_marks,
           (SELECT COUNT(*)
            FROM exam_processed_results r
            JOIN students s ON s.id = r.student_id AND s.school_id = r.school_id
            WHERE r.examination_id = e.id AND r.school_id = e.school_id
              AND s.current_class_id = e.class_id) as processed_count,
           (SELECT COUNT(*) FROM students WHERE current_class_id = e.class_id AND school_id = ? AND status = 'ACTIVE') as total_class_students
    FROM examinations e
    JOIN classes c ON e.class_id = c.id AND c.school_id = e.school_id
    JOIN academic_years y ON e.academic_year_id = y.id AND y.school_id = e.school_id
    JOIN academic_terms t ON e.term_id = t.id AND t.school_id = e.school_id
    LEFT JOIN grading_systems gs ON e.grading_system_id = gs.id AND gs.school_id = e.school_id
    WHERE e.school_id = ?
  `;
  const params = [schoolId, schoolId];

  if (classId) {
    sql += ` AND e.class_id = ?`;
    params.push(classId);
  }

  if (academicYearId) {
    sql += ` AND e.academic_year_id = ?`;
    params.push(academicYearId);
  }

  if (teacherUserId !== null && teacherUserId !== undefined) {
    sql += ` AND EXISTS (
      SELECT 1
      FROM teacher_allocations a
      JOIN teachers teacher ON teacher.id = a.teacher_id
      JOIN subjects sub ON sub.id = a.subject_id AND sub.school_id = a.school_id
      WHERE a.school_id = e.school_id
        AND a.class_id = e.class_id
        AND a.academic_year_id = e.academic_year_id
        AND teacher.school_id = a.school_id
        AND teacher.user_id = ?
        AND teacher.status = 'ACTIVE'
    )`;
    params.push(teacherUserId);
  }

  sql += ` ORDER BY e.created_at DESC`;
  const exams = db.all(sql, params);
  if (teacherUserId === null || teacherUserId === undefined) return exams;
  return exams.map(exam => ({
    ...exam,
    students_with_marks: null,
    processed_count: null,
    total_class_students: null
  }));
}

function getExamById(schoolId, examId) {
  const exam = db.get(
    `SELECT e.*, c.name as class_name, c.form_level, y.year_label, t.term_name, gs.name as grading_system_name
     FROM examinations e
     JOIN classes c ON e.class_id = c.id AND c.school_id = e.school_id
     JOIN academic_years y ON e.academic_year_id = y.id AND y.school_id = e.school_id
     JOIN academic_terms t ON e.term_id = t.id AND t.school_id = e.school_id
     LEFT JOIN grading_systems gs ON e.grading_system_id = gs.id AND gs.school_id = e.school_id
     WHERE e.id = ? AND e.school_id = ?`,
    [examId, schoolId]
  );
  return exam || null;
}

function createExam(schoolId, data) {
  const { academicYearId, termId, classId, name, examType, startDate, endDate, gradingSystemId } = data;

  const year = db.get(
    `SELECT id FROM academic_years WHERE id = ? AND school_id = ?`,
    [academicYearId, schoolId]
  );
  const term = db.get(
    `SELECT id FROM academic_terms WHERE id = ? AND school_id = ? AND academic_year_id = ?`,
    [termId, schoolId, academicYearId]
  );
  const classRecord = db.get(
    `SELECT id FROM classes WHERE id = ? AND school_id = ?`,
    [classId, schoolId]
  );
  if (!year || !term || !classRecord) {
    throw new Error('Academic year, term, and class must belong to this school.');
  }

  const defaultGradingSys = gradingSystemId || db.get(
    `SELECT id FROM grading_systems WHERE school_id = ? AND is_default = 1`,
    [schoolId]
  )?.id;
  if (defaultGradingSys) {
    const gradingSystem = db.get(
      `SELECT id FROM grading_systems WHERE id = ? AND school_id = ?`,
      [defaultGradingSys, schoolId]
    );
    if (!gradingSystem) {
      throw new Error('Grading system does not belong to this school.');
    }
  }

  const res = db.run(
    `INSERT INTO examinations (
       school_id, academic_year_id, term_id, class_id, name, 
       exam_type, start_date, end_date, is_locked, grading_system_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      schoolId,
      academicYearId,
      termId,
      classId,
      name,
      examType,
      startDate || null,
      endDate || null,
      defaultGradingSys
    ]
  );

  return getExamById(schoolId, res.lastInsertRowid);
}

function toggleExamLock(schoolId, examId, isLocked) {
  if (!getExamById(schoolId, examId)) {
    throw new Error('Examination not found or unauthorized.');
  }
  db.run(
    `UPDATE examinations SET is_locked = ? WHERE id = ? AND school_id = ?`,
    [isLocked ? 1 : 0, examId, schoolId]
  );
  return getExamById(schoolId, examId);
}

function getMarksSheet(schoolId, examId, subjectId, streamId = null, actor = null) {
  const exam = getExamById(schoolId, examId);
  if (!exam) throw new Error('Examination not found.');

  const subject = db.get(
    `SELECT * FROM subjects WHERE id = ? AND school_id = ?`,
    [subjectId, schoolId]
  );
  if (!subject) throw new Error('Subject not found.');

  if (streamId !== null) {
    const stream = db.get(
      `SELECT id FROM streams WHERE id = ? AND school_id = ? AND class_id = ?`,
      [streamId, schoolId, exam.class_id]
    );
    if (!stream) throw new Error('Stream does not belong to this examination class and school.');
  }

  let teacherAllocations = null;
  if (actor?.role === 'TEACHER') {
    teacherAllocations = accessService.getTeacherAllocations(actor.id, schoolId, {
      classId: exam.class_id,
      subjectId,
      academicYearId: exam.academic_year_id
    });
    if (teacherAllocations.length === 0) {
      throw new Error('You are not assigned to this subject and class.');
    }
    if (streamId !== null &&
        !teacherAllocations.some(a => a.stream_id === null || a.stream_id === streamId)) {
      throw new Error('You are not assigned to this stream.');
    }
  }

  let studentSql = `
    SELECT s.id as student_id, s.reg_number, s.first_name, s.middle_name, s.last_name, s.gender,
           st.name as stream_name,
           m.id as mark_id, m.marks, m.grade, m.points, m.remarks, m.is_absent
    FROM students s
    JOIN classes c ON c.id = s.current_class_id AND c.school_id = s.school_id
    LEFT JOIN streams st ON s.current_stream_id = st.id
      AND st.school_id = s.school_id
      AND st.class_id = s.current_class_id
    LEFT JOIN exam_marks m ON m.examination_id = ? AND m.student_id = s.id
      AND m.subject_id = ? AND m.school_id = s.school_id
    WHERE s.school_id = ? AND s.current_class_id = ? AND s.status = 'ACTIVE'
  `;
  const params = [examId, subjectId, schoolId, exam.class_id];

  if (streamId) {
    studentSql += ` AND s.current_stream_id = ?`;
    params.push(streamId);
  } else if (teacherAllocations && !teacherAllocations.some(a => a.stream_id === null)) {
    const streamIds = [...new Set(teacherAllocations.map(a => a.stream_id).filter(Boolean))];
    if (streamIds.length === 0) {
      studentSql += ` AND 1 = 0`;
    } else {
      studentSql += ` AND s.current_stream_id IN (${streamIds.map(() => '?').join(',')})`;
      params.push(...streamIds);
    }
  }

  studentSql += ` ORDER BY st.name ASC, s.last_name ASC, s.first_name ASC`;
  const rows = db.all(studentSql, params);

  return {
    exam,
    subject,
    students: rows
  };
}

function saveMarks(schoolId, examId, subjectId, marksList, userId, actor = null) {
  const exam = getExamById(schoolId, examId);
  if (!exam) throw new Error('Examination not found.');
  if (!Number.isSafeInteger(subjectId) || subjectId < 1) {
    throw new Error('A valid subject is required.');
  }
  if (!Array.isArray(marksList)) {
    throw new Error('Marks must be submitted as a list.');
  }
  const subject = db.get(
    `SELECT id FROM subjects WHERE id = ? AND school_id = ?`,
    [subjectId, schoolId]
  );
  if (!subject) throw new Error('Subject not found.');

  if (exam.is_locked) {
    throw new Error('This examination is locked by the Academic Master. Marks cannot be modified.');
  }

  const rules = getGradingRulesForExam(exam.grading_system_id, schoolId);

  const upsertStmt = db.prepare(`
    INSERT INTO exam_marks (
      school_id, examination_id, student_id, subject_id, marks, 
      grade, points, remarks, is_absent, entered_by_user_id, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(examination_id, student_id, subject_id) DO UPDATE SET
      marks = excluded.marks,
      grade = excluded.grade,
      points = excluded.points,
      remarks = excluded.remarks,
      is_absent = excluded.is_absent,
      entered_by_user_id = excluded.entered_by_user_id,
      updated_at = CURRENT_TIMESTAMP
  `);

  db.transaction(() => {
    for (const item of marksList) {
      const studentId = Number(item?.studentId);
      if (!Number.isSafeInteger(studentId) || studentId < 1) {
        throw new Error('Every mark must reference a valid student.');
      }
      const student = db.get(
        `SELECT id, current_class_id, current_stream_id
         FROM students
         WHERE id = ? AND school_id = ?`,
        [studentId, schoolId]
      );
      if (!student || student.current_class_id !== exam.class_id) {
        throw new Error('Every student must belong to this school and examination class.');
      }
      if (student.current_stream_id !== null) {
        const studentStream = db.get(
          `SELECT id FROM streams
           WHERE id = ? AND school_id = ? AND class_id = ?`,
          [student.current_stream_id, schoolId, exam.class_id]
        );
        if (!studentStream) {
          throw new Error('Student has an invalid stream assignment.');
        }
      }
      const existingMark = db.get(
        `SELECT school_id FROM exam_marks
         WHERE examination_id = ? AND student_id = ? AND subject_id = ?`,
        [examId, studentId, subjectId]
      );
      if (existingMark && existingMark.school_id !== schoolId) {
        throw new Error('Existing mark belongs to another school.');
      }
      if (actor?.role === 'TEACHER' &&
          !accessService.hasTeacherAllocation(
            actor.id,
            schoolId,
            exam.class_id,
            subjectId,
            exam.academic_year_id,
            student.current_stream_id
          )) {
        throw new Error('You are not assigned to this subject, class, and student stream.');
      }

      const isAbsent = item.isAbsent ? 1 : 0;
      let score = null;
      let grade = '-';
      let points = null;
      let remark = isAbsent ? 'Absent' : null;

      if (!isAbsent && item.marks !== null && item.marks !== undefined && item.marks !== '') {
        score = parseFloat(item.marks);
        if (score < 0 || score > 100) {
          throw new Error(`Invalid mark: ${score}. Marks must be between 0 and 100.`);
        }
        const gradeInfo = calculateGradeForMark(score, rules);
        grade = gradeInfo.grade;
        points = gradeInfo.points;
        remark = gradeInfo.remark;
      }

      upsertStmt.run(
        schoolId,
        examId,
        studentId,
        subjectId,
        score,
        grade,
        points,
        remark,
        isAbsent,
        userId
      );
    }
  });

  return { success: true, count: marksList.length };
}

module.exports = {
  getExaminations,
  getExamById,
  createExam,
  toggleExamLock,
  getMarksSheet,
  saveMarks
};
