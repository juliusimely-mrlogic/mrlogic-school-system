const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');

router.get('/subjects', authenticate, (req, res) => {
  res.json({ subjects: db.all('SELECT * FROM subjects WHERE school_id = ?', [req.query.school_id]) });
});

router.get('/combinations', authenticate, (req, res) => {
  const combos = db.all('SELECT * FROM combinations WHERE school_id = ?', [req.query.school_id]);
  const result = combos.map(c => {
    const subjects = db.all(`SELECT s.name FROM subjects s JOIN combination_subjects cs ON cs.subject_id = s.id WHERE cs.combination_id = ?`, [c.id]);
    return { ...c, subjects };
  });
  res.json({ combinations: result });
});
module.exports = router;