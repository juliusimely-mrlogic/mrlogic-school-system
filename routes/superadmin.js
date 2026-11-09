const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');

router.get('/stats', authenticate, async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Hauna ruhusa.' });
  try {
    const totalSchools = await db.get('SELECT COUNT(*) as n FROM schools');
    const totalDistricts = await db.get('SELECT COUNT(DISTINCT district) as n FROM schools');
    const totalStudents = await db.get('SELECT COUNT(*) as n FROM students');
    const totalSystemFees = await db.get("SELECT SUM(amount) as total FROM fees"); 
    res.json({ totalSchools: parseInt(totalSchools.n), totalDistricts: parseInt(totalDistricts.n), totalStudents: parseInt(totalStudents.n), totalSystemFees: totalSystemFees.total || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;