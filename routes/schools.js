const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');

router.post('/', authenticate, (req, res) => {
  const { code, name, region, district, schoolLevels } = req.body;
  try {
    db.run(`INSERT INTO schools (code, name, region, district) VALUES (?, ?, ?, ?)`, [code, name, region, district]);
    const school = db.get('SELECT * FROM schools WHERE code = ?', [code]);
    if (!school) return res.status(500).json({ error: 'Database imeshindwa kutengeneza shule' });

    if (schoolLevels && Array.isArray(schoolLevels)) {
      if (schoolLevels.includes('PRIMARY')) {
        for(let i=1; i<=6; i++) db.run(`INSERT INTO subjects (school_id, name, level_type) VALUES (?, ?, ?)`, [school.id, 'Primary Subject ' + i, 'PRIMARY']);
      }
      if (schoolLevels.includes('O_LEVEL')) {
        for(let i=1; i<=29; i++) db.run(`INSERT INTO subjects (school_id, name, level_type) VALUES (?, ?, ?)`, [school.id, 'O-Level Subject ' + i, 'O_LEVEL']);
      }
      if (schoolLevels.includes('A_LEVEL')) {
        for(let i=1; i<=30; i++) db.run(`INSERT INTO subjects (school_id, name, level_type) VALUES (?, ?, ?)`, [school.id, 'A-Level Subject ' + i, 'A_LEVEL']);
        for(let i=1; i<=86; i++) db.run(`INSERT INTO combinations (school_id, name, code) VALUES (?, ?, ?)`, [school.id, 'Combination ' + i, 'C' + i]);
      }
    }
    res.status(201).json({ message: 'Shule imesajiliwa', school });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', authenticate, (req, res) => {
  res.json({ schools: db.all('SELECT * FROM schools') });
});
module.exports = router;