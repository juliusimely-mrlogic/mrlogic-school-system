const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');
const { ensureLevelSetup } = require('../services/levelSetup');

router.post('/', authenticate, (req, res) => {
  const { name, code, region, district, ward, exam_center_no, headmaster_name, ownership, language, schoolLevels } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Jina na Code ni lazima.' });
  try {
    const existing = db.get('SELECT id FROM schools WHERE code = ?', [code]);
    if (existing) return res.status(400).json({ error: 'Msimbo umetumika.' });

    const levelsStr = JSON.stringify(schoolLevels || []);
    
    db.run(`INSERT INTO schools (code, name, region, district, ward, exam_center_no, headmaster_name, ownership, language, levels, subscription_expires) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+1 year'))`, 
      [code, name, region, district, ward, exam_center_no, headmaster_name, ownership, language, levelsStr]);
    
    const school = db.get('SELECT * FROM schools WHERE code = ?', [code]);
    
    if (schoolLevels && Array.isArray(schoolLevels)) {
      ensureLevelSetup(school.id, schoolLevels);
    }
    res.status(201).json({ message: 'Shule imesajiliwa', school });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', authenticate, (req, res) => {
  res.json({ schools: db.all('SELECT * FROM schools') });
});

// Kufuta au kuweka inactive (Super Admin pekee)
router.put('/:id/status', authenticate, (req, res) => {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Hauna ruhusa.' });
    const { is_active } = req.body;
    db.run(`UPDATE schools SET is_active = ? WHERE id = ?`, [is_active, req.params.id]);
    res.json({ message: 'Hali ya shule imebadilishwa' });
});

router.delete('/:id', authenticate, (req, res) => {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Hauna ruhusa.' });
    db.run('DELETE FROM schools WHERE id = ?', [req.params.id]);
    res.json({ message: 'Shule imefutwa' });
});

module.exports = router;