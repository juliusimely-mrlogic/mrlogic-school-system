const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');
const { ensureLevelSetup } = require('../services/levelSetup');

router.post('/', authenticate, (req, res) => {
  const { code, name, region, district, schoolLevels } = req.body;
  try {
    const levelsStr = JSON.stringify(schoolLevels || ['O_LEVEL']);
    
    db.run(`INSERT INTO schools (code, name, region, district, levels) VALUES (?, ?, ?, ?, ?)`, [code, name, region, district, levelsStr]);
    const school = db.get('SELECT * FROM schools WHERE code = ?', [code]);
    
    if (!school) return res.status(500).json({ error: 'Database imeshindwa kutengeneza shule' });

    // TUNATUMIA CODE YAKO HAPA KUTENGENEZA MASOMO NA MADARASA
    if (schoolLevels && Array.isArray(schoolLevels)) {
      ensureLevelSetup(school.id, schoolLevels);
    }

    res.status(201).json({ message: 'Shule imesajiliwa', school });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', authenticate, (req, res) => {
  res.json({ schools: db.all('SELECT * FROM schools') });
});
module.exports = router;