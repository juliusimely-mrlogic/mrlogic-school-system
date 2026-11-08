const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');

// GET: Kuvuta taarifa zote za shule
router.get('/', authenticate, (req, res) => {
  const { school_id } = req.query;
  if (!school_id) return res.status(400).json({ error: 'Weka school_id' });
  try {
    const notifications = db.all('SELECT * FROM notifications WHERE school_id = ? ORDER BY id DESC', [school_id]);
    res.json({ notifications });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST: Kuweka taarifa mpya kwa mkono
router.post('/', authenticate, (req, res) => {
  const { school_id, title, message } = req.body;
  if (!school_id || !title || !message) return res.status(400).json({ error: 'Taarifa hazijakamilika' });
  try {
    db.run(`INSERT INTO notifications (school_id, title, message) VALUES (?, ?, ?)`, [school_id, title, message]);
    res.status(201).json({ message: 'Taarifa imetumwa' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;