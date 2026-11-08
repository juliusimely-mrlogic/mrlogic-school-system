/**
 * MR LOGIC SCHOOL SYSTEM - Tanzanian NECTA & Custom Results Processing Engine
 * 
 * Supports:
 * - O-Level (Forms 1 - 4) CSEE Standard
 * - Best 7 Subjects aggregation
 * - Subject Points (A=1, B=2, C=3, D=4, F=5)
 * - Divisions (I: 7-17, II: 18-21, III: 22-25, IV: 26-33, 0: 34-35)
 * - School GPA & Subject GPA
 * - Class & Stream Rankings
 */
const db = require('../db/database');

// Default NECTA O-Level Grading Scale
const DEFAULT_NECTA_RULES = [
  { grade: 'A', minScore: 75, maxScore: 100, points: 1, remark: 'Distinction', gpaPoint: 1.0 },
  { grade: 'B', minScore: 65, maxScore: 74.99, points: 2, remark: 'Very Good', gpaPoint: 2.0 },
  { grade: 'C', minScore: 45, maxScore: 64.99, points: 3, remark: 'Good', gpaPoint: 3.0 },
  { grade: 'D', minScore: 30, maxScore: 44.99, points: 4, remark: 'Satisfactory', gpaPoint: 4.0 },
  { grade: 'F', minScore: 0, maxScore: 29.99, points: 5, remark: 'Fail', gpaPoint: 5.0 }
];

function getGradingRulesForExam(gradingSystemId = null, schoolId = null) {
  if (gradingSystemId) {
    if (schoolId) {
      const gradingSystem = db.get(
        `SELECT id FROM grading_systems WHERE id = ? AND school_id = ?`,
        [gradingSystemId, schoolId]
      );
      if (!gradingSystem) {
        throw new Error('Grading system not found or unauthorized.');
      }
    }
    const rules = db.all(
      `SELECT grade, min_score as minScore, max_score as maxScore, points, remark, gpa_point as gpaPoint 
       FROM grading_rules WHERE grading_system_id = ? ORDER BY points ASC`,
      [gradingSystemId]
    );
    if (rules && rules.length > 0) return rules;
  }

  if (schoolId) {
    const defaultSys = db.get(
      `SELECT id FROM grading_systems WHERE school_id = ? AND is_default = 1`,
      [schoolId]
    );
    if (defaultSys) {
      const rules = db.all(
        `SELECT grade, min_score as minScore, max_score as maxScore, points, remark, gpa_point as gpaPoint 
         FROM grading_rules WHERE grading_system_id = ? ORDER BY points ASC`,
        [defaultSys.id]
      );
      if (rules && rules.length > 0) return rules;
    }
  }

  return DEFAULT_NECTA_RULES;
}

function calculateGradeForMark(mark, rules = DEFAULT_NECTA_RULES) {
  if (mark === null || mark === undefined || isNaN(mark)) {
    return { grade: '-', points: 0, remark: 'Absent', gpaPoint: 0 };
  }
  const numericMark = Number(mark);
  for (const rule of rules) {
    if (numericMark >= rule.minScore && numericMark <= (rule.maxScore + 0.01)) {
      return {
        grade: rule.grade,
        points: rule.points,
        remark: rule.remark,
        gpaPoint: rule.gpaPoint
      };
    }
  }
  // Fallback to F
  return { grade: 'F', points: 5, remark: 'Fail', gpaPoint: 5.0 };
}

function calculateDivisionFromPoints(best7Points, subjectsPassed) {
  // NECTA standard: must have at least 2 passes (grade D or better) to obtain Division IV
  if (subjectsPassed < 2) {
    return '0';
  }
  if (best7Points >= 7 && best7Points <= 17) return 'I';
  if (best7Points >= 18 && best7Points <= 21) return 'II';
  if (best7Points >= 22 && best7Points <= 25) return 'III';
  if (best7Points >= 26 && best7Points <= 33) return 'IV';
  return '0';
}

/**
 * Process a student's marks in an examination
 */
function processStudentResult(studentMarks, rules = DEFAULT_NECTA_RULES) {
  const validMarks = studentMarks.filter(m => !m.is_absent && m.marks !== null && m.marks !== undefined);
  
  if (validMarks.length === 0) {
    return {
      totalMarks: 0,
      averageMarks: 0,
      gpa: 0,
      subjectsSat: 0,
      subjectsPassed: 0,
      bestSevenPoints: 35,
      division: '0',
      subjectResults: []
    };
  }

  const subjectResults = validMarks.map(m => {
    const gradeInfo = calculateGradeForMark(m.marks, rules);
    return {
      subjectId: m.subject_id,
      subjectCode: m.subject_code,
      subjectName: m.subject_name,
      marks: Number(m.marks),
      grade: gradeInfo.grade,
      points: gradeInfo.points,
      remark: gradeInfo.remark,
      gpaPoint: gradeInfo.gpaPoint,
      isPass: gradeInfo.points < 5
    };
  });

  const totalMarks = subjectResults.reduce((acc, curr) => acc + curr.marks, 0);
  const averageMarks = Number((totalMarks / subjectResults.length).toFixed(2));
  const subjectsSat = subjectResults.length;
  const subjectsPassed = subjectResults.filter(s => s.isPass).length;

  // Calculate GPA = average of GPA points
  const totalGpaPoints = subjectResults.reduce((acc, curr) => acc + curr.gpaPoint, 0);
  const gpa = Number((totalGpaPoints / subjectsSat).toFixed(4));

  // Sort subject points ascending (best grades first: 1 is A, 2 is B, 3 is C, 4 is D, 5 is F)
  const sortedPoints = subjectResults.map(s => s.points).sort((a, b) => a - b);
  
  // Take best 7 subjects; if fewer than 7 taken, pad missing subjects with 5 (F)
  const best7 = [...sortedPoints];
  while (best7.length < 7) {
    best7.push(5);
  }
  const best7Points = best7.slice(0, 7).reduce((acc, curr) => acc + curr, 0);
  const division = calculateDivisionFromPoints(best7Points, subjectsPassed);

  return {
    totalMarks: Number(totalMarks.toFixed(2)),
    averageMarks,
    gpa,
    subjectsSat,
    subjectsPassed,
    bestSevenPoints: best7Points,
    division,
    subjectResults
  };
}

/**
 * Process and update all results for an entire examination
 */
function processExamResults(examinationId, schoolId) {
  const exam = db.get(
    `SELECT e.*, c.name as class_name 
     FROM examinations e 
     JOIN classes c ON e.class_id = c.id AND c.school_id = e.school_id
     JOIN academic_years y ON y.id = e.academic_year_id AND y.school_id = e.school_id
     JOIN academic_terms t ON t.id = e.term_id AND t.school_id = e.school_id
     WHERE e.id = ? AND e.school_id = ?`,
    [examinationId, schoolId]
  );

  if (!exam) {
    throw new Error('Examination not found or unauthorized.');
  }

  const rules = getGradingRulesForExam(exam.grading_system_id, schoolId);

  // Fetch all marks for this examination
  const marksRows = db.all(
    `SELECT m.*, s.reg_number, s.first_name, s.middle_name, s.last_name, s.gender, s.current_stream_id,
            sub.code as subject_code, sub.name as subject_name
     FROM exam_marks m
     JOIN students s ON m.student_id = s.id AND s.school_id = m.school_id
     JOIN subjects sub ON m.subject_id = sub.id AND sub.school_id = m.school_id
     WHERE m.examination_id = ? AND m.school_id = ?
       AND s.current_class_id = ?`,
    [examinationId, schoolId, exam.class_id]
  );

  // Group marks by student
  const studentMap = new Map();
  for (const row of marksRows) {
    if (!studentMap.has(row.student_id)) {
      studentMap.set(row.student_id, {
        studentId: row.student_id,
        regNumber: row.reg_number,
        name: `${row.first_name} ${row.middle_name ? row.middle_name + ' ' : ''}${row.last_name}`,
        gender: row.gender,
        streamId: row.current_stream_id,
        marks: []
      });
    }
    studentMap.get(row.student_id).marks.push(row);
  }

  // Also include students in the class who might have 0 marks recorded yet
  const classStudents = db.all(
    `SELECT s.id as student_id, s.reg_number, s.first_name, s.middle_name, s.last_name, s.gender, s.current_stream_id
     FROM students s
     JOIN classes c ON c.id = s.current_class_id AND c.school_id = s.school_id
     WHERE s.current_class_id = ? AND s.school_id = ? AND s.status = 'ACTIVE'`,
    [exam.class_id, schoolId]
  );

  for (const s of classStudents) {
    if (!studentMap.has(s.student_id)) {
      studentMap.set(s.student_id, {
        studentId: s.student_id,
        regNumber: s.reg_number,
        name: `${s.first_name} ${s.middle_name ? s.middle_name + ' ' : ''}${s.last_name}`,
        gender: s.gender,
        streamId: s.current_stream_id,
        marks: []
      });
    }
  }

  const processedList = [];

  for (const [studentId, studentData] of studentMap.entries()) {
    const processed = processStudentResult(studentData.marks, rules);
    processedList.push({
      ...studentData,
      ...processed
    });
  }

  // Rank sorting priority:
  // 1. Division hierarchy: I=1, II=2, III=3, IV=4, 0=5
  // 2. Best 7 Points (ascending, lower is better)
  // 3. Average Marks (descending, higher is better)
  const divisionOrder = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, '0': 5 };

  processedList.sort((a, b) => {
    const divA = divisionOrder[a.division] || 5;
    const divB = divisionOrder[b.division] || 5;
    if (divA !== divB) return divA - divB;
    if (a.bestSevenPoints !== b.bestSevenPoints) return a.bestSevenPoints - b.bestSevenPoints;
    return b.averageMarks - a.averageMarks;
  });

  // Assign class rank
  processedList.forEach((item, index) => {
    item.classRank = index + 1;
  });

  // Assign stream rank
  const streamGroups = new Map();
  for (const item of processedList) {
    const sId = item.streamId || 0;
    if (!streamGroups.has(sId)) {
      streamGroups.set(sId, []);
    }
    streamGroups.get(sId).push(item);
  }

  for (const [sId, group] of streamGroups.entries()) {
    group.forEach((item, idx) => {
      item.streamRank = idx + 1;
    });
  }

  // Save to database inside transaction
  for (const item of processedList) {
    const existingResult = db.get(
      `SELECT school_id FROM exam_processed_results
       WHERE examination_id = ? AND student_id = ?`,
      [examinationId, item.studentId]
    );
    if (existingResult && existingResult.school_id !== schoolId) {
      throw new Error('Existing processed result belongs to another school.');
    }
  }

  db.transaction(() => {
    // Also update individual mark rows with grade and points
    const updateMarkStmt = db.prepare(
      `UPDATE exam_marks
       SET grade = ?, points = ?, remarks = ?
       WHERE id = ? AND school_id = ? AND examination_id = ?`
    );

    for (const item of processedList) {
      if (item.subjectResults) {
        for (const sub of item.subjectResults) {
          const mRow = item.marks.find(m => m.subject_id === sub.subjectId);
          if (mRow) {
            updateMarkStmt.run(sub.grade, sub.points, sub.remark, mRow.id, schoolId, examinationId);
          }
        }
      }
    }

    // Upsert processed results
    const upsertStmt = db.prepare(`
      INSERT INTO exam_processed_results (
        school_id, examination_id, student_id, total_marks, average_marks,
        gpa, subjects_sat, subjects_passed, best_seven_points, division,
        class_rank, stream_rank, processed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(examination_id, student_id) DO UPDATE SET
        total_marks = excluded.total_marks,
        average_marks = excluded.average_marks,
        gpa = excluded.gpa,
        subjects_sat = excluded.subjects_sat,
        subjects_passed = excluded.subjects_passed,
        best_seven_points = excluded.best_seven_points,
        division = excluded.division,
        class_rank = excluded.class_rank,
        stream_rank = excluded.stream_rank,
        processed_at = CURRENT_TIMESTAMP
    `);

    for (const item of processedList) {
      upsertStmt.run(
        schoolId,
        examinationId,
        item.studentId,
        item.totalMarks,
        item.averageMarks,
        item.gpa,
        item.subjectsSat,
        item.subjectsPassed,
        item.bestSevenPoints,
        item.division,
        item.classRank,
        item.streamRank
      );
    }
  });

  return {
    success: true,
    examinationId,
    totalStudents: processedList.length,
    processedList
  };
}

module.exports = {
  DEFAULT_NECTA_RULES,
  getGradingRulesForExam,
  calculateGradeForMark,
  calculateDivisionFromPoints,
  processStudentResult,
  processExamResults
};
