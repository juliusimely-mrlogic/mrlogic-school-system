const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');

router.get('/subjects', authenticate, async (req, res) => {
  try {
    const subjects = await db.all('SELECT * FROM subjects WHERE school_id = ? ORDER BY level_type ASC, name ASC', [req.query.school_id]);
    res.json({ subjects });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;