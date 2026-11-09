const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');
const { ensureLevelSetup } = require('../services/levelSetup');

// POST: Kusajili Shule
router.post('/', authenticate, (req, res) => {
  // Tunachukua taarifa zote mpya
  const { code, name, region, district, ward, exam_center_no, headmaster_name, ownership, language, schoolLevels } = req.body;
  
  if (!name) return res.status(400).json({ error: 'Jina la shule ni lazima.' });

  try {
    const existing = db.get('SELECT id FROM schools WHERE code = ?', [code]);
    if (existing) return res.status(400).json({ error: 'Msimbo (Code) umetumika.' });

    const stmt = db.run(
      `INSERT INTO schools (code, name, region, district, ward, exam_center_no, headmaster_name, ownership, language) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
      [code, name, region, district, ward, exam_center_no, headmaster_name, ownership, language]
    );
    
    const school = db.get('SELECT * FROM schools WHERE code = ?', [code]);
    if (!school) return res.status(500).json({ error: 'Database imeshindwa.' });

    if (schoolLevels && Array.isArray(schoolLevels)) {
      ensureLevelSetup(school.id, schoolLevels);
    }

    res.status(201).json({ message: 'Shule imesajiliwa', school });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE: Kufuta Shule (Kwa Super Admin tu)
router.delete('/:id', authenticate, (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Hauna ruhusa.' });
  try {
    db.run('DELETE FROM schools WHERE id = ?', [req.params.id]);
    res.json({ message: 'Shule imefutwa kikamilifu.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', authenticate, (req, res) => {
  // Kama ni Afisa Elimu, anaweza kuona shule za wilaya yake tu (Tutarekebisha hili kwenye Awamu 4)
  res.json({ schools: db.all('SELECT * FROM schools') });
});
module.exports = router;