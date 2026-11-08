const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');

router.post('/', authenticate, (req, res) => {
  const { school_id, student_id, amount, term, year, date_paid } = req.body;
  if (!school_id || !student_id || !amount || !term || !year) return res.status(400).json({ error: 'Taarifa hazijakamilika' });
  
  try {
    db.run(`INSERT INTO fees (school_id, student_id, amount, term, year, date_paid) VALUES (?, ?, ?, ?, ?, ?)`, [school_id, student_id, amount, term, year, date_paid || new Date().toISOString()]);
    
    // TENGENEZA TAARIFA KIOTOMATIKI
    const student = db.get('SELECT full_name FROM students WHERE id = ?', [student_id]);
    if (student) {
        const message = `Malipo yamepokelewa: ${student.full_name} amelipa Tsh ${amount.toLocaleString()} kwa ajili ya ${term} (${year}).`;
        db.run(`INSERT INTO notifications (school_id, title, message) VALUES (?, ?, ?)`, [school_id, 'Malipo Mapya', message]);
    }
    
    res.status(201).json({ message: 'Malipo yamerekodiwa' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/school/:school_id', authenticate, (req, res) => {
  try {
    const fees = db.all(`SELECT f.*, s.full_name FROM fees f JOIN students s ON s.id = f.student_id WHERE f.school_id = ? ORDER BY f.id DESC`, [req.params.school_id]);
    res.json({ fees, total_collected: fees.reduce((sum, f) => sum + f.amount, 0) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
module.exports = router;