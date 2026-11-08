const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');

router.post('/', authenticate, (req, res) => {
  const { school_id, name, level_type } = req.body;
  if (!school_id || !name || !level_type) return res.status(400).json({ error: 'Taarifa hazijakamilika' });
  try {
    db.run(`INSERT INTO classes (school_id, name, level_type) VALUES (?, ?, ?)`, [school_id, name, level_type]);
    res.status(201).json({ message: 'Darasa limesajiliwa', class: db.get('SELECT * FROM classes ORDER BY id DESC LIMIT 1') });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', authenticate, (req, res) => {
  res.json({ classes: db.all('SELECT * FROM classes WHERE school_id = ?', [req.query.school_id]) });
});
module.exports = router;