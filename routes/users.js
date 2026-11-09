const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { hashPassword } = require('../services/authService');
const authenticate = require('../middlewares/authMiddleware');

router.post('/', authenticate, (req, res) => {
  const { school_id, full_name, role } = req.body;
  
  if (!full_name || !role) return res.status(400).json({ error: 'Jina na Cheo vinahitajika.' });
  
  // Hakikisha shule inachukuliwa vizuri
  let finalSchoolId = null;
  if (req.user.role === 'SUPER_ADMIN') {
      if (!school_id) return res.status(400).json({ error: 'Tafadhali chagua shule kwanza kwenye dropdown ya juu.' });
      finalSchoolId = school_id;
  } else {
      finalSchoolId = req.user.school_id;
  }

  let baseUsername = full_name.toLowerCase().replace(/\s+/g, ''); 
  let username = baseUsername;
  let counter = 1;
  while (db.get('SELECT id FROM users WHERE username = ?', [username])) {
      username = `${baseUsername}${counter}`;
      counter++;
  }

  const defaultPassword = '1000';
  const { hash, salt } = hashPassword(defaultPassword);

  try {
    db.run(
      `INSERT INTO users (school_id, full_name, username, password_hash, salt, role, is_password_changed) 
       VALUES (?, ?, ?, ?, ?, ?, 0)`, 
      [finalSchoolId, full_name, username, hash, salt, role]
    );
    res.status(201).json({ 
        message: 'Mtumiaji amesajiliwa', 
        user: { username, defaultPassword } 
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', authenticate, (req, res) => {
  try {
    let users;
    if (req.user.role === 'SUPER_ADMIN') {
      users = db.all(`SELECT u.id, u.full_name, u.username, u.role, s.name as school_name FROM users u LEFT JOIN schools s ON u.school_id = s.id`);
    } else {
      users = db.all(`SELECT u.id, u.full_name, u.username, u.role, s.name as school_name FROM users u LEFT JOIN schools s ON u.school_id = s.id WHERE u.school_id = ?`, [req.user.school_id]);
    }
    res.json({ users });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;