const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');

router.post('/', authenticate, (req, res) => {
  const { school_id, class_id, name, term, year } = req.body;
  if (!school_id || !class_id || !name) return res.status(400).json({ error: 'Taarifa hazijakamilika' });
  try {
    db.run(`INSERT INTO exams (school_id, class_id, name, term, year) VALUES (?, ?, ?, ?, ?)`, [school_id, class_id, name, term, year]);
    res.status(201).json({ message: 'Mtihani umesajiliwa', exam: db.get('SELECT * FROM exams ORDER BY id DESC LIMIT 1') });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/results', authenticate, (req, res) => {
  const { exam_id, student_id, subject_id, marks } = req.body;
  if (!exam_id || !student_id || !subject_id || marks === undefined) return res.status(400).json({ error: 'Taarifa hazijakamilika' });
  try {
    db.run(`INSERT INTO exam_results (exam_id, student_id, subject_id, marks) VALUES (?, ?, ?, ?)`, [exam_id, student_id, subject_id, marks]);
    res.status(201).json({ message: 'Alama zimehifadhiwa' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', authenticate, (req, res) => {
  const { class_id, school_id } = req.query;
  let exams;
  if (school_id) exams = db.all('SELECT * FROM exams WHERE school_id = ?', [school_id]);
  else if (class_id) exams = db.all('SELECT * FROM exams WHERE class_id = ?', [class_id]);
  else exams = db.all('SELECT * FROM exams');
  res.json({ exams });
});

router.get('/results', authenticate, (req, res) => {
  const { exam_id } = req.query;
  if (!exam_id) return res.status(400).json({ error: 'Weka exam_id' });
  try {
    // Tumeongeza er.student_id hapa
    res.json({ results: db.all(`SELECT er.marks, er.student_id, s.full_name AS student_name, sub.name AS subject_name FROM exam_results er JOIN students s ON s.id = er.student_id JOIN subjects sub ON sub.id = er.subject_id WHERE er.exam_id = ?`, [exam_id]) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;