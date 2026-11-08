const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');

router.get('/subjects', authenticate, (req, res) => {
  try {
    const subjects = db.all('SELECT * FROM subjects WHERE school_id = ? ORDER BY level_type ASC, name ASC', [req.query.school_id]);
    res.json({ subjects });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/combinations', authenticate, (req, res) => {
  try {
    const combos = db.all('SELECT * FROM combinations WHERE school_id = ? ORDER BY code ASC', [req.query.school_id]);
    const result = combos.map(c => {
      const subjects = db.all(`SELECT s.name FROM subjects s JOIN combination_subjects cs ON cs.subject_id = s.id WHERE cs.combination_id = ?`, [c.id]);
      return { ...c, subjects };
    });
    res.json({ combinations: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;