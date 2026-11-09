const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const config = require('../config');
const { verifyPassword, hashPassword } = require('../services/authService');

// LOGIN
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
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        full_name: user.full_name, 
        role: user.role, 
        is_password_changed: user.is_password_changed 
      } 
    });
  } catch (err) {
    res.status(500).json({ error: 'Kosa la token: ' + err.message });
  }
});

// CHANGE PASSWORD (Inahitaji token)
router.post('/change-password', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Hakuna token' });

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({ error: 'Password mpya ni lazima iwe na herufi 4 au zaidi.' });
    }

    const a = hashPassword(newPassword);
    db.run(`UPDATE users SET password_hash = ?, salt = ?, is_password_changed = 1 WHERE id = ?`, [a.hash, a.salt, decoded.id]);
    
    res.json({ message: 'Password imebadilishwa kikamilifu!' });
  } catch (err) {
    res.status(401).json({ error: 'Token si sahihi au imeisha muda.' });
  }
});

module.exports = router;