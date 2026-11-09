const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');
const { ensureLevelSetup } = require('../services/levelSetup');

router.post('/', authenticate, async (req, res) => {
  let { name, code, region, district, ward, exam_center_no, headmaster_name, ownership, language, schoolLevels } = req.body;
  
  if (!name || !code) return res.status(400).json({ error: 'Jina na Msimbo wa Shule ni lazima.' });
  code = code.trim(); name = name.trim();

  try {
    const existing = await db.get('SELECT id FROM schools WHERE code = ?', [code]);
    if (existing) {
      return res.status(400).json({ error: `Msimbo (${code}) umetumika.` });
    }

    const levelsStr = JSON.stringify(schoolLevels || []);
    
    await db.run(`INSERT INTO schools (code, name, region, district, ward, exam_center_no, headmaster_name, ownership, language, levels, subscription_expires) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW() + INTERVAL '1 year')`, 
      [code, name, region, district, ward, exam_center_no, headmaster_name, ownership, language, levelsStr]);
    
    const school = await db.get('SELECT * FROM schools WHERE code = ?', [code]);
    if (!school) return res.status(500).json({ error: 'Shule imeingizwa lakini haipatikani.' });
    
    if (schoolLevels && Array.isArray(schoolLevels)) {
      try {
        await ensureLevelSetup(school.id, schoolLevels);
      } catch (levelError) {
        return res.status(500).json({ error: 'Kosa la kutengeneza madarasa: ' + levelError.message });
      }
    }
    
    res.status(201).json({ message: 'Shule imesajiliwa kikamilifu', school });
  } catch (err) { 
    res.status(500).json({ error: 'Kosa la Server: ' + err.message }); 
  }
});

// API MPYA: Kupakia Sahihi na Muhuri
router.put('/:id/assets', authenticate, async (req, res) => {
    const { headmaster_signature, school_stamp } = req.body;
    try {
        await db.run(`UPDATE schools SET headmaster_signature = ?, school_stamp = ? WHERE id = ?`, [headmaster_signature, school_stamp, req.params.id]);
        res.json({ message: 'Picha zimehifadhiwa kikamilifu!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const schools = await db.all('SELECT * FROM schools');
    res.json({ schools });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/clear-all', authenticate, async (req, res) => {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Hauna ruhusa.' });
    try {
        await db.run('DELETE FROM schools');
        res.json({ message: 'Shule zote zimefutwa kikamilifu.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticate, async (req, res) => {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Hauna ruhusa.' });
    try {
      await db.run('DELETE FROM schools WHERE id = ?', [req.params.id]);
      res.json({ message: 'Shule imefutwa' });
    } catch(err) { res.status(500).json({error: err.message}); }
});

module.exports = router;