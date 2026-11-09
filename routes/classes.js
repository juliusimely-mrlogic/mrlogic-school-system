const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');

router.post('/', authenticate, async (req, res) => {
  if (req.user.role === 'TEACHER') return res.status(403).json({ error: 'Mwalimu hawezi kuongeza darasa.' });
  const { school_id, name, level_type } = req.body;
  if (!school_id || !name || !level_type) return res.status(400).json({ error: 'Taarifa hazijakamilika' });
  try {
    const result = await db.run(`INSERT INTO classes (school_id, name, level_type) VALUES (?, ?, ?)`, [school_id, name, level_type]);
    const newClass = await db.get('SELECT * FROM classes WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ message: 'Darasa limesajiliwa', class: newClass });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', authenticate, async (req, res) => {
  try {
    let classes;
    if (req.user.role === 'TEACHER' && req.user.teacher_id) {
        // Mwalimu anaona madarasa aliyopangiwa tu
        classes = await db.all(`
            SELECT DISTINCT c.* FROM classes c
            JOIN teacher_assignments ta ON c.id = ta.class_id
            WHERE ta.teacher_id = ?
        `, [req.user.teacher_id]);
    } else {
        classes = await db.all('SELECT * FROM classes WHERE school_id = ?', [req.query.school_id]);
    }
    res.json({ classes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  if (req.user.role === 'TEACHER') return res.status(403).json({ error: 'Mwalimu hawezi kufuta darasa.' });
  try {
    await db.run('DELETE FROM classes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Darasa limefutwa' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;