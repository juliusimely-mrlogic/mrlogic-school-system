/**
 * MR LOGIC SCHOOL SYSTEM - Academic Structures Service
 * Manages Academic Years, Terms, Classes (Forms 1-4), Streams, and Subjects.
 */
const db = require('../db/database');
const accessService = require('./accessService');

function getAcademicYears(schoolId, teacherUserId = null) {
  if (teacherUserId !== null) {
    const yearIds = [...new Set(
      accessService.getTeacherAllocations(teacherUserId, schoolId)
        .map(allocation => allocation.academic_year_id)
    )];
    if (yearIds.length === 0) return [];
    return db.all(
      `SELECT * FROM academic_years
       WHERE school_id = ? AND id IN (${yearIds.map(() => '?').join(',')})
       ORDER BY year_label DESC`,
      [schoolId, ...yearIds]
    );
  }
  return db.all(
    `SELECT * FROM academic_years WHERE school_id = ? ORDER BY year_label DESC`,
    [schoolId]
  );
}

function getTerms(schoolId, academicYearId = null, teacherUserId = null) {
  let sql = `SELECT t.*, y.year_label 
             FROM academic_terms t 
             JOIN academic_years y ON t.academic_year_id = y.id 
             WHERE t.school_id = ? AND y.school_id = t.school_id`;
  const params = [schoolId];

  if (teacherUserId !== null) {
    const yearIds = [...new Set(
      accessService.getTeacherAllocations(teacherUserId, schoolId)
        .map(allocation => allocation.academic_year_id)
    )];
    if (yearIds.length === 0) return [];
    sql += ` AND t.academic_year_id IN (${yearIds.map(() => '?').join(',')})`;
    params.push(...yearIds);
  }

  if (academicYearId) {
    sql += ` AND t.academic_year_id = ?`;
    params.push(academicYearId);
  }

  sql += ` ORDER BY y.year_label DESC, t.term_name ASC`;
  return db.all(sql, params);
}

function getClassesWithStreams(schoolId, teacherUserId = null) {
  if (teacherUserId !== null) {
    const allocations = accessService.getTeacherAllocations(teacherUserId, schoolId);
    const classIds = [...new Set(allocations.map(allocation => allocation.class_id))];
    if (classIds.length === 0) return [];

    const classes = db.all(
      `SELECT c.id, c.school_id, c.form_level, c.name, c.numeric_order
       FROM classes c
       WHERE c.school_id = ? AND c.id IN (${classIds.map(() => '?').join(',')})
       ORDER BY c.numeric_order ASC`,
      [schoolId, ...classIds]
    );
    const streams = db.all(
      `SELECT st.id, st.school_id, st.class_id, st.name
       FROM streams st
       WHERE st.school_id = ?
       ORDER BY st.name ASC`,
      [schoolId]
    );

    return classes.map(classRecord => {
      const classAllocations = allocations.filter(a => a.class_id === classRecord.id);
      const hasWholeClassAllocation = classAllocations.some(a => a.stream_id === null);
      const assignedStreamIds = new Set(classAllocations.map(a => a.stream_id).filter(Boolean));
      const visibleStreams = streams.filter(stream =>
        stream.class_id === classRecord.id &&
        (hasWholeClassAllocation || assignedStreamIds.has(stream.id))
      );
      let studentCountSql = `
        SELECT COUNT(*) as count FROM students
        WHERE school_id = ? AND current_class_id = ? AND status = 'ACTIVE'
      `;
      const studentCountParams = [schoolId, classRecord.id];
      if (!hasWholeClassAllocation) {
        if (assignedStreamIds.size === 0) {
          studentCountSql += ` AND 1 = 0`;
        } else {
          studentCountSql += ` AND current_stream_id IN (${[...assignedStreamIds].map(() => '?').join(',')})`;
          studentCountParams.push(...assignedStreamIds);
        }
      }
      const totalStudents = db.get(studentCountSql, studentCountParams)?.count || 0;
      return {
        ...classRecord,
        total_students: totalStudents,
        streams: visibleStreams.map(stream => ({
          ...stream,
          total_students: db.get(
            `SELECT COUNT(*) as count FROM students
             WHERE school_id = ? AND current_class_id = ? AND current_stream_id = ? AND status = 'ACTIVE'`,
            [schoolId, classRecord.id, stream.id]
          )?.count || 0
        }))
      };
    });
  }

  const classes = db.all(
    `SELECT c.*, 
            (SELECT COUNT(*) FROM students WHERE current_class_id = c.id AND school_id = ? AND status = 'ACTIVE') as total_students
     FROM classes c 
     WHERE c.school_id = ? 
     ORDER BY c.numeric_order ASC`,
    [schoolId, schoolId]
  );

  const streams = db.all(
    `SELECT st.*, 
            (SELECT COUNT(*) FROM students WHERE current_stream_id = st.id AND school_id = ? AND status = 'ACTIVE') as total_students
     FROM streams st 
     WHERE st.school_id = ? 
     ORDER BY st.name ASC`,
    [schoolId, schoolId]
  );

  return classes.map(c => ({
    ...c,
    streams: streams.filter(s => s.class_id === c.id)
  }));
}

function getStreams(schoolId, classId = null, teacherUserId = null) {
  let sql = `SELECT st.*, c.name as class_name, c.form_level
             FROM streams st
             JOIN classes c ON st.class_id = c.id AND c.school_id = st.school_id
             WHERE st.school_id = ?`;
  const params = [schoolId];

  if (classId) {
    sql += ` AND st.class_id = ?`;
    params.push(classId);
  }

  sql += ` ORDER BY c.numeric_order ASC, st.name ASC`;
  const streams = db.all(sql, params);
  if (teacherUserId === null) return streams;

  const allocations = accessService.getTeacherAllocations(teacherUserId, schoolId);
  return streams.filter(stream => {
    const classAllocations = allocations.filter(a => a.class_id === stream.class_id);
    return classAllocations.some(a => a.stream_id === null || a.stream_id === stream.id);
  });
}

function createStream(schoolId, classId, name) {
  const trimmedName = (name || '').trim();
  if (!trimmedName) throw new Error('Stream name is required (e.g., Stream C, Stream D).');

  const classRecord = db.get(
    `SELECT * FROM classes WHERE id = ? AND school_id = ?`,
    [classId, schoolId]
  );
  if (!classRecord) {
    throw new Error('Class/Form does not exist or does not belong to this school.');
  }

  const existing = db.get(
    `SELECT * FROM streams WHERE school_id = ? AND class_id = ? AND LOWER(name) = LOWER(?)`,
    [schoolId, classId, trimmedName]
  );
  if (existing) {
    return existing;
  }

  const res = db.run(
    `INSERT INTO streams (school_id, class_id, name) VALUES (?, ?, ?)`,
    [schoolId, classId, trimmedName]
  );

  return db.get(`SELECT * FROM streams WHERE id = ?`, [res.lastInsertRowid]);
}

function getSubjects(schoolId, teacherUserId = null) {
  if (teacherUserId !== null) {
    const subjectIds = [...new Set(
      accessService.getTeacherAllocations(teacherUserId, schoolId)
        .map(allocation => allocation.subject_id)
    )];
    if (subjectIds.length === 0) return [];
    return db.all(
      `SELECT *
       FROM subjects
       WHERE school_id = ? AND id IN (${subjectIds.map(() => '?').join(',')})
       ORDER BY is_core DESC, name ASC`,
      [schoolId, ...subjectIds]
    );
  }
  return db.all(
    `SELECT s.*,
            (SELECT COUNT(*) FROM teacher_allocations WHERE subject_id = s.id AND school_id = ?) as allocated_teachers
     FROM subjects s 
     WHERE s.school_id = ? 
     ORDER BY s.is_core DESC, s.name ASC`,
    [schoolId, schoolId]
  );
}

module.exports = {
  getAcademicYears,
  getTerms,
  getClassesWithStreams,
  getStreams,
  createStream,
  getSubjects
};
