const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');

router.get('/stats', authenticate, (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Hauna ruhusa.' });
  try {
    const totalSchools = db.get('SELECT COUNT(*) as n FROM schools').n;
    const totalDistricts = db.get('SELECT COUNT(DISTINCT district) as n FROM schools').n;
    const totalStudents = db.get('SELECT COUNT(*) as n FROM students').n;
    const totalSystemFees = db.get("SELECT SUM(amount) as total FROM fees").total || 0; 
    // Hapa tunapaswa kuhesabu malipo ya shule kwa mfumo (system_payments), kwa sasa tunatumia malipo ya ada kama mfano.
    
    res.json({ totalSchools, totalDistricts, totalStudents, totalSystemFees });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;