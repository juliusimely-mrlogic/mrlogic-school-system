const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');
const { ensureLevelSetup } = require('../services/levelSetup');

// POST: Kusajili Shule (Bila kukagua level column kwa kuwa haipo)
router.post('/', authenticate, (req, res) => {
  const { name, code, region, district, ward, exam_center_no, headmaster_name, ownership, language, schoolLevels } = req.body;
  
  if (!name) return res.status(400).json({ error: 'Jina la shule ni lazima.' });

  try {
    const existing = db.get('SELECT id FROM schools WHERE code = ?', [code]);
    if (existing) return res.status(400).json({ error: 'Msimbo (Code) umetumika.' });

    db.run(
      `INSERT INTO schools (code, name, region, district, ward, exam_center_no, headmaster_name, ownership, language) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
      [code, name, region, district, ward, exam_center_no, headmaster_name, ownership, language]
    );
    
    const school = db.get('SELECT * FROM schools WHERE code = ?', [code]);
    
    if (schoolLevels && Array.isArray(schoolLevels)) {
      ensureLevelSetup(school.id, schoolLevels);
    }

    res.status(201).json({ message: 'Shule imesajiliwa', school });
  } catch (err) { 
    console.error("DB Insert Error:", err);
    res.status(500).json({ error: err.message }); 
  }
});

router.get('/', authenticate, (req, res) => {
  res.json({ schools: db.all('SELECT * FROM schools') });
});

module.exports = router;