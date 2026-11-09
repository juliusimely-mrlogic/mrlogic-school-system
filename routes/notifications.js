const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');

router.get('/', authenticate, async (req, res) => {
  try {
    const notifications = await db.all('SELECT * FROM notifications WHERE school_id = ? ORDER BY id DESC', [req.query.school_id]);
    res.json({ notifications });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, async (req, res) => {
  const { school_id, title, message } = req.body;
  try {
    await db.run(`INSERT INTO notifications (school_id, title, message) VALUES (?, ?, ?)`, [school_id, title, message]);
    res.status(201).json({ message: 'Taarifa imetumwa' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;