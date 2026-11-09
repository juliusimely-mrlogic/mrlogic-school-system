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
    
    // 1. Sajili Shule
    await db.run(`INSERT INTO schools (code, name, region, district, ward, exam_center_no, headmaster_name, ownership, language, levels, subscription_expires) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW() + INTERVAL '1 year')`, 
      [code, name, region, district, ward, exam_center_no, headmaster_name, ownership, language, levelsStr]);
    
    const school = await db.get('SELECT * FROM schools WHERE code = ?', [code]);
    if (!school) return res.status(500).json({ error: 'Shule imeingizwa lakini haipatikani.' });
    
    // 2. Tengeneza Madarasa na Masomo
    let classesCreated = 0;
    if (schoolLevels && Array.isArray(schoolLevels)) {
      try {
        classesCreated = await ensureLevelSetup(school.id, schoolLevels);
      } catch (levelError) {
        return res.status(500).json({ error: 'Kosa la kutengeneza madarasa: ' + levelError.message });
      }
    }
    
    // 3. KINGA: Kama hakuna darasa lililotengenezwa, tunatupa kosa!
    if (classesCreated === 0 && schoolLevels && schoolLevels.length > 0) {
        return res.status(500).json({ error: 'Shule imesajiliwa, lakini madarasa hayakutengenezwa. Tafadhali wasiliana na msimamizi.' });
    }
    
    res.status(201).json({ message: 'Shule imesajiliwa na madarasa yametengenezwa', school, classesCreated });
  } catch (err) { 
    console.error("Kosa la kusajili:", err);
    res.status(500).json({ error: 'Kosa la Server: ' + err.message }); 
  }
});

// (Weka functions zingine za GET, DELETE, clear-all kama zilivyokuwa)
router.get('/', authenticate, async (req, res) => {
  const schools = await db.all('SELECT * FROM schools');
  res.json({ schools });
});
router.delete('/clear-all', authenticate, async (req, res) => {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Hauna ruhusa.' });
    await db.run('DELETE FROM schools');
    res.json({ message: 'Shule zote zimefutwa.' });
});
router.delete('/:id', authenticate, async (req, res) => {
    await db.run('DELETE FROM schools WHERE id = ?', [req.params.id]);
    res.json({ message: 'Shule imefutwa' });
});
module.exports = router;