const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const config = require('../config');
const { verifyPassword } = require('../services/authService');

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Weka username na password' });

  const user = db.get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) return res.status(401).json({ error: 'Username haipo kwenye database' });

  if (!verifyPassword(password, user.password_hash)) return res.status(401).json({ error: 'Password si sahihi' });

  try {
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, school_id: user.school_id },
      config.jwtSecret, 
      { expiresIn: '1d' }
    );
    res.json({ token, user: { id: user.id, full_name: user.full_name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Kosa la token: ' + err.message });
  }
});
module.exports = router;