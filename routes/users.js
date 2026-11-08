const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { hashPassword } = require('../services/authService');
const authenticate = require('../middlewares/authMiddleware');

router.post('/', authenticate, (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'SCHOOL_ADMIN') return res.status(403).json({ error: 'Hauna ruhusa' });
  const { school_id, full_name, email, username, password, role } = req.body;
  if (!full_name || !username || !password || !role) return res.status(400).json({ error: 'Taarifa hazijakamilika' });
  
  if (db.get('SELECT id FROM users WHERE username = ?', [username])) return res.status(400).json({ error: 'Username imetumika' });

  const { hash, salt } = hashPassword(password);
  try {
    db.run(`INSERT INTO users (school_id, full_name, email, username, password_hash, salt, role) VALUES (?, ?, ?, ?, ?, ?, ?)`, [school_id || null, full_name, email || null, username, hash, salt, role]);
    res.status(201).json({ message: 'Mtumiaji amesajiliwa' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
module.exports = router;