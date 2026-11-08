/**
 * School and teacher assignment authorization queries.
 */
const db = require('../db/database');

function getTeacherAllocations(userId, schoolId, filters = {}) {
  let sql = `
    SELECT a.subject_id, a.class_id, a.stream_id, a.academic_year_id
    FROM teacher_allocations a
    JOIN teachers t ON t.id = a.teacher_id
    JOIN subjects s ON s.id = a.subject_id AND s.school_id = a.school_id
    JOIN classes c ON c.id = a.class_id AND c.school_id = a.school_id
    JOIN academic_years y ON y.id = a.academic_year_id AND y.school_id = a.school_id
    LEFT JOIN streams st ON st.id = a.stream_id
      AND st.school_id = a.school_id
      AND st.class_id = a.class_id
    WHERE a.school_id = ?
      AND t.school_id = ?
      AND t.user_id = ?
      AND t.status = 'ACTIVE'
      AND (a.stream_id IS NULL OR st.id IS NOT NULL)
  `;
  const params = [schoolId, schoolId, userId];

  if (filters.classId !== undefined) {
    sql += ` AND a.class_id = ?`;
    params.push(filters.classId);
  }
  if (filters.subjectId !== undefined) {
    sql += ` AND a.subject_id = ?`;
    params.push(filters.subjectId);
  }
  if (filters.academicYearId !== undefined) {
    sql += ` AND a.academic_year_id = ?`;
    params.push(filters.academicYearId);
  }
  if (Object.prototype.hasOwnProperty.call(filters, 'streamId')) {
    if (filters.streamId === null) {
      sql += ` AND a.stream_id IS NULL`;
    } else {
      sql += ` AND (a.stream_id IS NULL OR a.stream_id = ?)`;
      params.push(filters.streamId);
    }
  }

  return db.all(sql, params);
}

function hasTeacherAllocation(userId, schoolId, classId, subjectId, academicYearId, streamId) {
  return getTeacherAllocations(userId, schoolId, {
    classId,
    subjectId,
    academicYearId,
    streamId
  }).length > 0;
}

function getTeacherExamAllocations(userId, schoolId, exam) {
  if (!exam) return [];
  return getTeacherAllocations(userId, schoolId, {
    classId: exam.class_id,
    academicYearId: exam.academic_year_id
  });
}

module.exports = {
  getTeacherAllocations,
  getTeacherExamAllocations,
  hasTeacherAllocation
};
