const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');
const { ensureLevelSetup } = require('../services/levelSetup');

router.post('/', authenticate, (req, res) => {
  const { code, name, region, district, schoolLevels } = req.body;
  
  try {
    // 1. Angalia kama msimbo wa shule umetumika
    const existing = db.get('SELECT id FROM schools WHERE code = ?', [code]);
    if (existing) {
        return res.status(400).json({ error: 'Msimbo huu wa shule (Code) umetumika tayari. Chagua mwingine.' });
    }

    // 2. Sajili shule (Bila column ya 'levels' kwa kuwa haipo kwenye database yetu mpya)
    db.run(`INSERT INTO schools (code, name, region, district) VALUES (?, ?, ?, ?)`, [code, name, region, district]);
    const school = db.get('SELECT * FROM schools WHERE code = ?', [code]);
    
    if (!school) return res.status(500).json({ error: 'Database imeshindwa kutengeneza shule' });

    // 3. Tengeneza madarasa, masomo, na mchepuo kwa kutumia code yako nzuri
    if (schoolLevels && Array.isArray(schoolLevels)) {
      ensureLevelSetup(school.id, schoolLevels);
    }

    res.status(201).json({ message: 'Shule imesajiliwa kikamilifu', school });
  } catch (err) { 
    console.error("Kosa la kusajili shule:", err);
    res.status(500).json({ error: 'Kosa la Database: ' + err.message }); 
  }
});

router.get('/', authenticate, (req, res) => {
  res.json({ schools: db.all('SELECT * FROM schools') });
});
module.exports = router;