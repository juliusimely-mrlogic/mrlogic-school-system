/**
 * MR LOGIC SCHOOL SYSTEM - Reports, Broadsheets & Performance Analysis Service
 */
const db = require('../db/database');
const { getExamById } = require('./examService');
const accessService = require('./accessService');

function getExamBroadsheet(schoolId, examId, actor = null) {
  const exam = getExamById(schoolId, examId);
  if (!exam) throw new Error('Examination not found.');

  const teacherAllocations = actor?.role === 'TEACHER'
    ? accessService.getTeacherExamAllocations(actor.id, schoolId, exam)
    : null;
  if (teacherAllocations && teacherAllocations.length === 0) {
    throw new Error('You are not assigned to this examination.');
  }
  const allowedSubjectIds = teacherAllocations
    ? [...new Set(teacherAllocations.map(a => a.subject_id))]
    : null;

  const subjects = allowedSubjectIds
    ? allowedSubjectIds.length === 0
      ? []
      : db.all(
          `SELECT id, code, name, is_core
           FROM subjects
           WHERE school_id = ? AND id IN (${allowedSubjectIds.map(() => '?').join(',')})
           ORDER BY is_core DESC, code ASC`,
          [schoolId, ...allowedSubjectIds]
        )
    : db.all(
        `SELECT DISTINCT s.id, s.code, s.name, s.is_core
         FROM subjects s
         JOIN exam_marks m ON m.subject_id = s.id AND m.school_id = s.school_id
         WHERE m.examination_id = ? AND m.school_id = ?
         ORDER BY s.is_core DESC, s.code ASC`,
        [examId, schoolId]
      );

  const results = db.all(
    `SELECT r.*, s.reg_number, s.first_name, s.middle_name, s.last_name, s.gender,
            s.current_stream_id, st.name as stream_name
     FROM exam_processed_results r
     JOIN students s ON r.student_id = s.id AND s.school_id = r.school_id
     LEFT JOIN streams st ON s.current_stream_id = st.id
       AND st.school_id = s.school_id AND st.class_id = s.current_class_id
     WHERE r.examination_id = ? AND r.school_id = ?
       AND s.current_class_id = ?
     ORDER BY r.class_rank ASC`,
    [examId, schoolId, exam.class_id]
  );

  const allMarks = db.all(
    `SELECT m.student_id, m.subject_id, m.marks, m.grade, m.points, m.is_absent
     FROM exam_marks m
     JOIN students s ON s.id = m.student_id AND s.school_id = m.school_id
     JOIN subjects sub ON sub.id = m.subject_id AND sub.school_id = m.school_id
     WHERE m.examination_id = ? AND m.school_id = ? AND s.current_class_id = ?`,
    [examId, schoolId, exam.class_id]
  );

  const marksLookup = new Map();
  for (const m of allMarks) {
    const result = results.find(row => row.student_id === m.student_id);
    if (!result) continue;
    if (teacherAllocations &&
        !accessService.hasTeacherAllocation(
          actor.id,
          schoolId,
          exam.class_id,
          m.subject_id,
          exam.academic_year_id,
          result.current_stream_id
        )) continue;
    const key = `${m.student_id}_${m.subject_id}`;
    marksLookup.set(key, m);
  }

  const visibleResults = teacherAllocations
    ? results.filter(row => teacherAllocations.some(a =>
        a.stream_id === null || a.stream_id === row.current_stream_id
      ))
    : results;
  const broadsheetRows = visibleResults.map(row => {
    const studentSubjects = {};
    for (const sub of subjects) {
      const mark = marksLookup.get(`${row.student_id}_${sub.id}`);
      studentSubjects[sub.code] = mark
        ? {
            marks: mark.is_absent ? 'ABS' : mark.marks,
            grade: mark.grade || '-',
            points: mark.points
          }
        : { marks: '-', grade: '-', points: '-' };
    }

    const restrictedRow = {
      studentId: row.student_id,
      regNumber: row.reg_number,
      fullName: `${row.first_name} ${row.middle_name ? row.middle_name + ' ' : ''}${row.last_name}`,
      gender: row.gender,
      streamName: row.stream_name || 'General',
      subjects: studentSubjects
    };
    if (!teacherAllocations) {
      Object.assign(restrictedRow, {
        totalMarks: row.total_marks,
        averageMarks: row.average_marks,
        gpa: row.gpa,
        bestSevenPoints: row.best_seven_points,
        division: row.division,
        classRank: row.class_rank,
        streamRank: row.stream_rank
      });
    }
    return restrictedRow;
  });

  return {
    exam,
    subjects,
    rows: broadsheetRows
  };
}

function getStudentReportCard(schoolId, examId, studentId, actor = null) {
  const exam = getExamById(schoolId, examId);
  if (!exam) throw new Error('Examination not found.');

  const school = db.get(`SELECT * FROM schools WHERE id = ?`, [schoolId]);

  const isTeacher = actor?.role === 'TEACHER';
  const student = db.get(
    `SELECT ${isTeacher
      ? 's.id, s.school_id, s.reg_number, s.first_name, s.middle_name, s.last_name, s.gender, s.current_class_id, s.current_stream_id'
      : 's.*'}, c.name as class_name, st.name as stream_name
     FROM students s
     JOIN classes c ON s.current_class_id = c.id AND c.school_id = s.school_id
     LEFT JOIN streams st ON s.current_stream_id = st.id
       AND st.school_id = s.school_id AND st.class_id = s.current_class_id
     WHERE s.id = ? AND s.school_id = ?`,
    [studentId, schoolId]
  );
  if (!student) throw new Error('Student not found.');
  if (student.current_class_id !== exam.class_id) {
    throw new Error('Student does not belong to this examination class.');
  }

  const teacherAllocations = isTeacher
    ? accessService.getTeacherAllocations(actor.id, schoolId, {
        classId: exam.class_id,
        academicYearId: exam.academic_year_id
      })
    : null;
  if (teacherAllocations &&
      !teacherAllocations.some(a =>
        a.stream_id === null || a.stream_id === student.current_stream_id
      )) {
    throw new Error('Student is outside your assigned class and stream.');
  }

  const summary = isTeacher ? null : db.get(
    `SELECT * FROM exam_processed_results
     WHERE examination_id = ? AND student_id = ? AND school_id = ?`,
    [examId, studentId, schoolId]
  );

  const marks = db.all(
    `SELECT m.*, sub.code as subject_code, sub.name as subject_name
     FROM exam_marks m
     JOIN subjects sub ON m.subject_id = sub.id AND sub.school_id = m.school_id
     WHERE m.examination_id = ? AND m.student_id = ? AND m.school_id = ?
     ORDER BY sub.is_core DESC, sub.name ASC`,
    [examId, studentId, schoolId]
  ).filter(mark => !teacherAllocations || accessService.hasTeacherAllocation(
    actor.id,
    schoolId,
    exam.class_id,
    mark.subject_id,
    exam.academic_year_id,
    student.current_stream_id
  ));

  const totalClassStudents = isTeacher ? null : db.get(
    `SELECT COUNT(*) as count FROM exam_processed_results
     WHERE examination_id = ? AND school_id = ?`,
    [examId, schoolId]
  )?.count || 0;

  return {
    school,
    exam,
    student,
    summary,
    totalClassStudents,
    marks
  };
}

function getSubjectPerformance(schoolId, examId, actor = null) {
  const exam = getExamById(schoolId, examId);
  if (!exam) throw new Error('Examination not found.');

  const teacherAllocations = actor?.role === 'TEACHER'
    ? accessService.getTeacherExamAllocations(actor.id, schoolId, exam)
    : null;
  if (teacherAllocations && teacherAllocations.length === 0) {
    throw new Error('You are not assigned to this examination.');
  }

  const subjects = db.all(
    `SELECT s.id, s.code, s.name,
            COUNT(m.id) as candidates,
            ROUND(AVG(m.marks), 2) as average_mark,
            ROUND(AVG(m.points), 2) as subject_gpa,
            SUM(CASE WHEN m.grade = 'A' THEN 1 ELSE 0 END) as count_a,
            SUM(CASE WHEN m.grade = 'B' THEN 1 ELSE 0 END) as count_b,
            SUM(CASE WHEN m.grade = 'C' THEN 1 ELSE 0 END) as count_c,
            SUM(CASE WHEN m.grade = 'D' THEN 1 ELSE 0 END) as count_d,
            SUM(CASE WHEN m.grade = 'F' THEN 1 ELSE 0 END) as count_f,
            ROUND(100.0 * SUM(CASE WHEN m.points < 5 THEN 1 ELSE 0 END) / NULLIF(COUNT(m.id), 0), 1) as pass_rate
     FROM subjects s
     JOIN exam_marks m ON m.subject_id = s.id
     JOIN students st ON st.id = m.student_id AND st.school_id = m.school_id
     WHERE m.examination_id = ? AND m.school_id = ? AND m.is_absent = 0
       AND s.school_id = m.school_id
       AND st.current_class_id = ?
       AND (? = 0 OR EXISTS (
         SELECT 1
         FROM teacher_allocations a
         JOIN teachers t ON t.id = a.teacher_id AND t.school_id = a.school_id
         WHERE a.school_id = m.school_id
           AND a.class_id = ?
           AND a.academic_year_id = ?
           AND a.subject_id = m.subject_id
           AND t.user_id = ?
           AND t.status = 'ACTIVE'
           AND (a.stream_id IS NULL OR a.stream_id = st.current_stream_id)
       ))
     GROUP BY s.id
     ORDER BY pass_rate DESC, average_mark DESC`,
    [
      examId,
      schoolId,
      exam.class_id,
      teacherAllocations ? 1 : 0,
      exam.class_id,
      exam.academic_year_id,
      actor?.id || null
    ]
  );

  return subjects;
}

function getDivisionDistribution(schoolId, examId) {
  const counts = db.all(
    `SELECT division, COUNT(*) as count
     FROM exam_processed_results
     WHERE examination_id = ? AND school_id = ?
     GROUP BY division`,
    [examId, schoolId]
  );

  const distribution = {
    'I': 0,
    'II': 0,
    'III': 0,
    'IV': 0,
    '0': 0,
    total: 0
  };

  for (const c of counts) {
    if (distribution.hasOwnProperty(c.division)) {
      distribution[c.division] = c.count;
    }
    distribution.total += c.count;
  }

  return distribution;
}

module.exports = {
  getExamBroadsheet,
  getStudentReportCard,
  getSubjectPerformance,
  getDivisionDistribution
};
