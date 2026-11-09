const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');

router.get('/', authenticate, (req, res) => {
  const { school_id } = req.query;
  try {
    res.json({ notifications: db.all('SELECT * FROM notifications WHERE school_id = ? ORDER BY id DESC', [school_id]) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, (req, res) => {
  const { school_id, title, message } = req.body;
  try {
    db.run(`INSERT INTO notifications (school_id, title, message) VALUES (?, ?, ?)`, [school_id, title, message]);
    res.status(201).json({ message: 'Taarifa imetumwa' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;