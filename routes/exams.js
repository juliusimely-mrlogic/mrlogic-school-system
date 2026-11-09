const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');
const { processStudentResults } = require('../services/gradingService');

// 1. POST: Kutengeneza mtihani mpya
router.post('/', authenticate, (req, res) => {
  const { school_id, class_id, name, term, year } = req.body;
  if (!school_id || !class_id || !name) return res.status(400).json({ error: 'Taarifa hazijakamilika' });
  try {
    db.run(`INSERT INTO exams (school_id, class_id, name, term, year) VALUES (?, ?, ?, ?, ?)`, [school_id, class_id, name, term, year]);
    res.status(201).json({ message: 'Mtihani umesajiliwa', exam: db.get('SELECT * FROM exams ORDER BY id DESC LIMIT 1') });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. GET: Kuvuta mitihani
router.get('/', authenticate, (req, res) => {
  const { class_id, school_id } = req.query;
  try {
    let exams;
    if (school_id) exams = db.all('SELECT * FROM exams WHERE school_id = ?', [school_id]);
    else if (class_id) exams = db.all('SELECT * FROM exams WHERE class_id = ?', [class_id]);
    else exams = db.all('SELECT * FROM exams');
    res.json({ exams });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. POST: Kuweka alama
router.post('/results', authenticate, (req, res) => {
  const { exam_id, student_id, subject_id, marks } = req.body;
  if (!exam_id || !student_id || !subject_id || marks === undefined) return res.status(400).json({ error: 'Taarifa hazijakamilika' });
  try {
    db.run(`INSERT INTO exam_results (exam_id, student_id, subject_id, marks) VALUES (?, ?, ?, ?)`, [exam_id, student_id, subject_id, marks]);
    res.status(201).json({ message: 'Alama zimehifadhiwa' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. PUT: Kuthibitisha Matokeo (Publish) - Mtaaluma Mkuu au Super Admin pekee
router.put('/:id/publish', authenticate, (req, res) => {
  if (req.user.role !== 'ACADEMIC_HEAD' && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Hauna ruhusa ya kuthibitisha matokeo. Ni Mtaaluma Mkuu pekee.' });
  }
  try {
    db.run(`UPDATE exams SET is_published = 1 WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Matokeo yamethibitishwa kikamilifu!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. GET: Kuvuta Matokeo ya Mtihani (Yakiwa yamechakatwa kwa NECTA)
router.get('/processed/:exam_id', authenticate, (req, res) => {
  const { exam_id } = req.params;
  try {
    const exam = db.get(`SELECT e.*, c.level_type FROM exams e JOIN classes c ON e.class_id = c.id WHERE e.id = ?`, [exam_id]);
    if (!exam) return res.status(404).json({ error: 'Mtihani haupo' });

    const students = db.all(`SELECT id, full_name, gender, admission_number FROM students WHERE class_id = ?`, [exam.class_id]);
    const allResults = db.all(`SELECT r.student_id, r.marks, s.name AS subject_name, s.a_level_role FROM exam_results r JOIN subjects s ON r.subject_id = s.id WHERE r.exam_id = ?`, [exam_id]);

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