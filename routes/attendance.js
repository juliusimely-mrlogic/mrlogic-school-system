const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');

router.post('/', authenticate, async (req, res) => {
  const { school_id, class_id, date, records } = req.body; 
  if (!school_id || !class_id || !date || !Array.isArray(records)) return res.status(400).json({ error: 'Taarifa hazijakamilika' });
  try {
    await db.run(`DELETE FROM attendance WHERE class_id = ? AND date = ?`, [class_id, date]);
    for (const r of records) {
      await db.run(`INSERT INTO attendance (school_id, class_id, student_id, date, status) VALUES (?, ?, ?, ?, ?)`, [school_id, class_id, r.student_id, date, r.status]);
    }
    res.status(201).json({ message: 'Mahudhurio yamehifadhiwa' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;