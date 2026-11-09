const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');

router.post('/', authenticate, async (req, res) => {
  const { school_id, class_id, full_name, gender, admission_number, parent_phone } = req.body;
  if (!school_id || !class_id || !full_name || !admission_number) return res.status(400).json({ error: 'Taarifa hazijakamilika' });
  try {
    const result = await db.run(`INSERT INTO students (school_id, class_id, full_name, gender, admission_number, parent_phone) VALUES (?, ?, ?, ?, ?, ?)`, [school_id, class_id, full_name, gender, admission_number, parent_phone || null]);
    res.status(201).json({ message: 'Mwanafunzi amesajiliwa' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', authenticate, async (req, res) => {
  const { school_id, class_id } = req.query;
  let query = 'SELECT * FROM students WHERE school_id = ?';
  let params = [school_id];
  if (class_id) { query += ' AND class_id = ?'; params.push(class_id); }
  try {
    const students = await db.all(query, params);
    res.json({ students });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await db.run('DELETE FROM students WHERE id = ?', [req.params.id]);
    res.json({ message: 'Mwanafunzi amefutwa' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;