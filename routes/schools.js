const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');
const { ensureLevelSetup } = require('../services/levelSetup');

router.post('/', authenticate, async (req, res) => {
  const { name, code, region, district, ward, exam_center_no, headmaster_name, ownership, language, schoolLevels } = req.body;
  
  if (!name || !code || code.trim() === '') return res.status(400).json({ error: 'Jina na Msimbo wa Shule ni lazima.' });

  try {
    const existing = await db.get('SELECT id, code FROM schools WHERE code = ?', [code]);
    if (existing) {
      // Tunaonyesha msimbo halisi unaosumbua
      return res.status(400).json({ error: `Msimbo umetumika (${existing.code}). Badilisha msimbo huu au tumia kitufe cha "Futa Shule Zote".` });
    }

    const levelsStr = JSON.stringify(schoolLevels || []);
    const result = await db.run(`INSERT INTO schools (code, name, region, district, ward, exam_center_no, headmaster_name, ownership, language, levels, subscription_expires) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW() + INTERVAL '1 year')`, 
      [code, name, region, district, ward, exam_center_no, headmaster_name, ownership, language, levelsStr]);
    
    const school = await db.get('SELECT * FROM schools WHERE id = ?', [result.lastInsertRowid]);
    
    if (schoolLevels && Array.isArray(schoolLevels)) {
      await ensureLevelSetup(school.id, schoolLevels);
    }
    res.status(201).json({ message: 'Shule imesajiliwa', school });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const schools = await db.all('SELECT * FROM schools');
    res.json({ schools });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// KITUFE KIPYA CHA KUFUTA SHULE ZOTE (Kwa ajili ya kusafisha database wakati wa majaribio)
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