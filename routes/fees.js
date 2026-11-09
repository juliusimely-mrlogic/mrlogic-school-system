const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');

router.post('/', authenticate, async (req, res) => {
  const { school_id, student_id, amount, term, year } = req.body;
  if (!school_id || !student_id || !amount || !term || !year) return res.status(400).json({ error: 'Taarifa hazijakamilika' });
  try {
    await db.run(`INSERT INTO fees (school_id, student_id, amount, term, year, date_paid) VALUES (?, ?, ?, ?, ?, NOW())`, [school_id, student_id, amount, term, year]);
    const student = await db.get('SELECT full_name FROM students WHERE id = ?', [student_id]);
    if (student) {
        await db.run(`INSERT INTO notifications (school_id, title, message) VALUES (?, ?, ?)`, [school_id, 'Malipo Mapya', `${student.full_name} amelipa Tsh ${amount.toLocaleString()} (${term} ${year}).`]);
    }
    res.status(201).json({ message: 'Malipo yamerekodiwa' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/school/:school_id', authenticate, async (req, res) => {
  try {
    const fees = await db.all(`SELECT f.*, s.full_name FROM fees f JOIN students s ON s.id = f.student_id WHERE f.school_id = ? ORDER BY f.id DESC`, [req.params.school_id]);
    res.json({ fees, total_collected: fees.reduce((sum, f) => sum + f.amount, 0) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/structure', authenticate, async (req, res) => {
  const { school_id, class_id, term, year, amount } = req.body;
  if (!school_id || !class_id || !term || !year || !amount) return res.status(400).json({ error: 'Taarifa hazijakamilika' });
  try {
    await db.run(`DELETE FROM fee_structure WHERE school_id = ? AND class_id = ? AND term = ? AND year = ?`, [school_id, class_id, term, year]);
    await db.run(`INSERT INTO fee_structure (school_id, class_id, term, year, amount) VALUES (?, ?, ?, ?, ?)`, [school_id, class_id, term, year, amount]);
    res.status(201).json({ message: 'Ada imewekwa kikamilifu' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/status/:school_id', authenticate, async (req, res) => {
  const { school_id } = req.params;
  const { term, year } = req.query;
  try {
    const students = await db.all(`SELECT s.id, s.full_name, s.admission_number, c.name as class_name, c.id as class_id FROM students s JOIN classes c ON s.class_id = c.id WHERE s.school_id = ?`, [school_id]);
    const structures = await db.all(`SELECT * FROM fee_structure WHERE school_id = ? AND term = ? AND year = ?`, [school_id, term, year]);
    const payments = await db.all(`SELECT student_id, SUM(amount) as total_paid FROM fees WHERE school_id = ? AND term = ? AND year = ? GROUP BY student_id`, [school_id, term, year]);

    const statusList = students.map(student => {
      const struct = structures.find(s => s.class_id === student.class_id);
      const requiredAmount = struct ? struct.amount : 0;
      const payment = payments.find(p => p.student_id === student.id);
      const paidAmount = payment ? payment.total_paid : 0;
      const balance = requiredAmount - paidAmount;
      let status = 'HAJALIPA';
      if (paidAmount >= requiredAmount && requiredAmount > 0) status = 'AMELIPA ZOTE';
      else if (paidAmount > 0 && paidAmount < requiredAmount) status = 'AMELIPA KIDOGO';
      return { ...student, requiredAmount, paidAmount, balance, status };
    });
    res.json({ statusList });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;