/**
 * MR LOGIC SCHOOL SYSTEM - Dashboard Analytics Service
 */
const db = require('../db/database');
const { getDivisionDistribution, getSubjectPerformance } = require('./reportService');

function getDashboardSummary(schoolId = null) {
  // If no schoolId provided, return Super Admin System-Wide Overview
  if (!schoolId) {
    const totalSchools = db.get(`SELECT COUNT(*) as count FROM schools WHERE is_active = 1`)?.count || 0;
    const totalStudents = db.get(`SELECT COUNT(*) as count FROM students WHERE status = 'ACTIVE'`)?.count || 0;
    const totalTeachers = db.get(`SELECT COUNT(*) as count FROM teachers WHERE status = 'ACTIVE'`)?.count || 0;
    const totalExams = db.get(`SELECT COUNT(*) as count FROM examinations`)?.count || 0;
    
    const schools = db.all(`
      SELECT s.*,
             (SELECT COUNT(*) FROM students WHERE school_id = s.id AND status = 'ACTIVE') as student_count,
             (SELECT COUNT(*) FROM teachers WHERE school_id = s.id AND status = 'ACTIVE') as teacher_count
      FROM schools s
      ORDER BY s.created_at DESC
    `);

    return {
      isSuperAdmin: true,
      stats: {
        totalSchools,
        totalStudents,
        totalTeachers,
        totalExams
      },
      schools
    };
  }

  // School-specific Dashboard
  const school = db.get(`SELECT * FROM schools WHERE id = ?`, [schoolId]);
  if (!school) throw new Error('School not found.');

  const currentYear = db.get(
    `SELECT * FROM academic_years WHERE school_id = ? AND is_current = 1 LIMIT 1`,
    [schoolId]
  );

  const currentTerm = currentYear
    ? db.get(
        `SELECT * FROM academic_terms WHERE school_id = ? AND academic_year_id = ? AND is_current = 1 LIMIT 1`,
        [schoolId, currentYear.id]
      )
    : null;

  // Counts
  const totalStudents = db.get(
    `SELECT COUNT(*) as count FROM students WHERE school_id = ? AND status = 'ACTIVE'`,
    [schoolId]
  )?.count || 0;

  const boysCount = db.get(
    `SELECT COUNT(*) as count FROM students WHERE school_id = ? AND gender = 'M' AND status = 'ACTIVE'`,
    [schoolId]
  )?.count || 0;

  const girlsCount = db.get(
    `SELECT COUNT(*) as count FROM students WHERE school_id = ? AND gender = 'F' AND status = 'ACTIVE'`,
    [schoolId]
  )?.count || 0;

  const totalTeachers = db.get(
    `SELECT COUNT(*) as count FROM teachers WHERE school_id = ? AND status = 'ACTIVE'`,
    [schoolId]
  )?.count || 0;

  const totalClasses = db.get(
    `SELECT COUNT(*) as count FROM classes WHERE school_id = ?`,
    [schoolId]
  )?.count || 0;

  const totalStreams = db.get(
    `SELECT COUNT(*) as count FROM streams WHERE school_id = ?`,
    [schoolId]
  )?.count || 0;

  const totalExams = db.get(
    `SELECT COUNT(*) as count FROM examinations WHERE school_id = ?`,
    [schoolId]
  )?.count || 0;

  // Latest Examination
  const latestExam = db.get(
    `SELECT e.*, c.name as class_name 
     FROM examinations e 
     JOIN classes c ON e.class_id = c.id AND c.school_id = e.school_id
     WHERE e.school_id = ? 
     ORDER BY e.created_at DESC LIMIT 1`,
    [schoolId]
  );

  let divisionDistribution = null;
  let topStudents = [];
  let subjectRanking = [];

  if (latestExam) {
    divisionDistribution = getDivisionDistribution(schoolId, latestExam.id);
    
    topStudents = db.all(
      `SELECT r.class_rank, s.reg_number, s.first_name, s.last_name, s.gender,
              r.best_seven_points, r.division, r.average_marks, r.gpa, st.name as stream_name
       FROM exam_processed_results r
       JOIN students s ON r.student_id = s.id AND s.school_id = r.school_id
       LEFT JOIN streams st ON s.current_stream_id = st.id
         AND st.school_id = s.school_id AND st.class_id = s.current_class_id
       WHERE r.examination_id = ? AND r.school_id = ?
         AND s.current_class_id = ?
       ORDER BY r.class_rank ASC LIMIT 5`,
      [latestExam.id, schoolId, latestExam.class_id]
    );

    subjectRanking = getSubjectPerformance(schoolId, latestExam.id);
  }

  // Class enrollment distribution
  const classBreakdown = db.all(
    `SELECT c.id, c.name, c.form_level,
            COUNT(s.id) as student_count,
            SUM(CASE WHEN s.gender = 'M' THEN 1 ELSE 0 END) as boys,
            SUM(CASE WHEN s.gender = 'F' THEN 1 ELSE 0 END) as girls
     FROM classes c
     LEFT JOIN students s ON s.current_class_id = c.id
       AND s.school_id = c.school_id AND s.status = 'ACTIVE'
     WHERE c.school_id = ?
     GROUP BY c.id
     ORDER BY c.numeric_order ASC`,
    [schoolId]
  );

  return {
    isSuperAdmin: false,
    school,
    currentAcademicYear: currentYear,
    currentTerm,
    stats: {
      totalStudents,
      boysCount,
      girlsCount,
      totalTeachers,
      totalClasses,
      totalStreams,
      totalExams
    },
    latestExam,
    divisionDistribution,
    topStudents,
    subjectRanking,
    classBreakdown
  };
}

module.exports = {
  getDashboardSummary
};
