const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');
const { processStudentResults } = require('../services/gradingService');

router.post('/', authenticate, async (req, res) => {
  if (req.user.role === 'TEACHER') return res.status(403).json({ error: 'Mwalimu hawezi kutengeneza mtihani.' });
  const { school_id, class_id, name, term, year } = req.body;
  if (!school_id || !class_id || !name) return res.status(400).json({ error: 'Taarifa hazijakamilika' });
  try {
    const result = await db.run(`INSERT INTO exams (school_id, class_id, name, term, year) VALUES (?, ?, ?, ?, ?)`, [school_id, class_id, name, term, year]);
    const newExam = await db.get('SELECT * FROM exams WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ message: 'Mtihani umesajiliwa', exam: newExam });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', authenticate, async (req, res) => {
  const { school_id, class_id } = req.query;
  try {
    let exams;
    if (req.user.role === 'TEACHER' && req.user.teacher_id) {
        exams = await db.all(`
            SELECT DISTINCT e.* FROM exams e
            JOIN teacher_assignments ta ON e.class_id = ta.class_id
            WHERE ta.teacher_id = ?
        `, [req.user.teacher_id]);
    } else {
        if (school_id) exams = await db.all('SELECT * FROM exams WHERE school_id = ?', [school_id]);
        else if (class_id) exams = await db.all('SELECT * FROM exams WHERE class_id = ?', [class_id]);
        else exams = await db.all('SELECT * FROM exams');
    }
    res.json({ exams });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/results', authenticate, async (req, res) => {
  const { exam_id, student_id, subject_id, marks } = req.body;
  if (!exam_id || !student_id || !subject_id || marks === undefined) return res.status(400).json({ error: 'Taarifa hazijakamilika' });
  try {
    await db.run(`INSERT INTO exam_results (exam_id, student_id, subject_id, marks) VALUES (?, ?, ?, ?)`, [exam_id, student_id, subject_id, marks]);
    res.status(201).json({ message: 'Alama zimehifadhiwa' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/publish', authenticate, async (req, res) => {
  if (req.user.role === 'TEACHER') return res.status(403).json({ error: 'Mwalimu hawezi kuthibitisha matokeo.' });
  if (req.user.role !== 'ACADEMIC_HEAD' && req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Hauna ruhusa.' });
  try {
    await db.run(`UPDATE exams SET is_published = 1 WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Matokeo yamethibitishwa!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/processed/:exam_id', authenticate, async (req, res) => {
  const { exam_id } = req.params;
  try {
    const exam = await db.get(`SELECT e.*, c.level_type FROM exams e JOIN classes c ON e.class_id = c.id WHERE e.id = ?`, [exam_id]);
    if (!exam) return res.status(404).json({ error: 'Mtihani haupo' });

    const students = await db.all(`SELECT id, full_name, gender, admission_number FROM students WHERE class_id = ?`, [exam.class_id]);
    const allResults = await db.all(`SELECT r.student_id, r.marks, s.name AS subject_name, s.a_level_role FROM exam_results r JOIN subjects s ON r.subject_id = s.id WHERE r.exam_id = ?`, [exam_id]);

    let processedResults = students.map(student => {
      const studentMarks = allResults.filter(r => r.student_id === student.id);
      const processed = processStudentResults(studentMarks, exam.level_type);
      return { ...student, ...processed };
    });

    processedResults.sort((a, b) => a.aggregatePoints - b.aggregatePoints);
    processedResults = processedResults.map((r, index) => ({ ...r, rank: index + 1 }));
    res.json({ exam, results: processedResults });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;