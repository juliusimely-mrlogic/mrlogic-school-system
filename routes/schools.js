const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');
const { ensureLevelSetup } = require('../services/levelSetup');

router.post('/', authenticate, (req, res) => {
  const { name, code, region, district, ward, exam_center_no, headmaster_name, ownership, language, schoolLevels } = req.body;
  if (!name) return res.status(400).json({ error: 'Jina la shule ni lazima.' });
  try {
    const existing = db.get('SELECT id FROM schools WHERE code = ?', [code]);
    if (existing) return res.status(400).json({ error: 'Msimbo (Code) umetumika.' });

    db.run(`INSERT INTO schools (code, name, region, district, ward, exam_center_no, headmaster_name, ownership, language) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [code, name, region, district, ward, exam_center_no, headmaster_name, ownership, language]);
    const school = db.get('SELECT * FROM schools WHERE code = ?', [code]);
    
    if (schoolLevels && Array.isArray(schoolLevels)) {
      ensureLevelSetup(school.id, schoolLevels);
    }
    res.status(201).json({ message: 'Shule imesajiliwa', school });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticate, (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Hauna ruhusa.' });
  try {
    db.run('DELETE FROM schools WHERE id = ?', [req.params.id]);
    res.json({ message: 'Shule imefutwa.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', authenticate, (req, res) => {
  res.json({ schools: db.all('SELECT * FROM schools') });
});

// API MPYA ILIYOBORESHWA: Uchambuzi wa Halmashauri
router.get('/district/:district_name', authenticate, (req, res) => {
  const district = req.params.district_name;
  
  try {
    // Pata shule zote za wilaya hiyo
    const schools = db.all('SELECT id, name, code FROM schools WHERE district = ?', [district]);
    
    // Kwa kila shule, hesabu wastani wa pointi za wanafunzi wake
    let schoolRankings = schools.map(school => {
        const latestExam = db.get('SELECT id FROM exams WHERE school_id = ? ORDER BY id DESC LIMIT 1', [school.id]);
        
        if (!latestExam) {
            return { ...school, avgMarks: 0, studentsCount: 0 };
        }

        const avgData = db.get(`
            SELECT AVG(marks) as avg_mark, COUNT(DISTINCT student_id) as student_count 
            FROM exam_results 
            WHERE exam_id = ?
        `, [latestExam.id]);

        // Kama hakuna wanafunzi waliowekwa alama, wastani ni 0
        let avg = avgData.avg_mark ? parseFloat(avgData.avg_mark).toFixed(2) : 0;
        let count = avgData.student_count || 0;

        return { 
            ...school, 
            avgMarks: avg,
            studentsCount: count
        };
    });

    // TOA SHULE ZISIZO NA WANAFUNZI AU ALAMA KWENYE ORODHA
    schoolRankings = schoolRankings.filter(s => s.studentsCount > 0);

    // Panga shule kwa alama (kutoka juu kwenda chini)
    schoolRankings.sort((a, b) => b.avgMarks - a.avgMarks);

    // Chukua 10 bora na 5 dhaifu
    const top10 = schoolRankings.slice(0, 10);
    // Kwa bottom 5, tunachukua za mwisho, kisha tunazipanga vizuri
    const bottom5 = schoolRankings.slice(-5).reverse(); 

    res.json({ top10, bottom5 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;