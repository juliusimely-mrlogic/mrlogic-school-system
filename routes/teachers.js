const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');

router.post('/', authenticate, async (req, res) => {
  const { school_id, full_name, phone, gender } = req.body;
  if (!school_id || !full_name) return res.status(400).json({ error: 'Taarifa hazijakamilika' });
  try {
    const result = await db.run(`INSERT INTO teachers (school_id, full_name, phone, gender) VALUES (?, ?, ?, ?)`, [school_id, full_name, phone || null, gender || null]);
    const teacher = await db.get('SELECT * FROM teachers WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ message: 'Mwalimu amesajiliwa', teacher });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const teachers = await db.all('SELECT * FROM teachers WHERE school_id = ?', [req.query.school_id]);
    res.json({ teachers });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/assign', authenticate, async (req, res) => {
  const { school_id, teacher_id, class_id, subject_id } = req.body;
  if (!school_id || !teacher_id || !class_id || !subject_id) return res.status(400).json({ error: 'Taarifa hazijakamilika' });
  try {
    await db.run(`INSERT INTO teacher_assignments (school_id, teacher_id, class_id, subject_id) VALUES (?, ?, ?, ?)`, [school_id, teacher_id, class_id, subject_id]);
    res.status(201).json({ message: 'Mgawanyo umefanikiwa' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/assignments', authenticate, async (req, res) => {
  try {
    const assignments = await db.all(`SELECT ta.id, t.full_name AS teacher_name, c.name AS class_name, s.name AS subject_name FROM teacher_assignments ta JOIN teachers t ON t.id = ta.teacher_id JOIN classes c ON c.id = ta.class_id JOIN subjects s ON s.id = ta.subject_id WHERE ta.school_id = ?`, [req.query.school_id]);
    res.json({ assignments });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;