const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { hashPassword } = require('../services/authService');
const authenticate = require('../middlewares/authMiddleware');

// POST: Kusajili Mtumiaji Mpya
router.post('/', authenticate, (req, res) => {
  // Ni Super Admin au School Manager pekee anayeruhusiwa
  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'SCHOOL_MANAGER') {
    return res.status(403).json({ error: 'Hauna ruhusa ya kusajili watumiaji.' });
  }

  const { school_id, full_name, role } = req.body;
  
  if (!full_name || !role) return res.status(400).json({ error: 'Jina na Cheo vinahitajika.' });
  
  // Tengeneza Username kiotomatiki kutoka kwa Jina (Mfano: "John Doe" -> johndoe1000)
  let baseUsername = full_name.toLowerCase().replace(/\s+/g, ''); 
  let username = baseUsername;
  let counter = 1;
  while (db.get('SELECT id FROM users WHERE username = ?', [username])) {
      username = `${baseUsername}${counter}`;
      counter++;
  }

  // Password ya Awali ni 1000
  const defaultPassword = '1000';
  const { hash, salt } = hashPassword(defaultPassword);

  // Kama ni School Manager anasajili, basi lazima amuweke kwenye shule yake (hataweza kusajili shule nyingine)
  const finalSchoolId = (req.user.role === 'SCHOOL_MANAGER') ? req.user.school_id : (school_id || null);

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

// GET: Kuona Watumiaji
router.get('/', authenticate, (req, res) => {
  try {
    let users;
    if (req.user.role === 'SUPER_ADMIN') {
      users = db.all(`SELECT u.id, u.full_name, u.username, u.role, s.name as school_name FROM users u LEFT JOIN schools s ON u.school_id = s.id`);
    } else {
      // School Manager anaona watumiaji wa shule yake tu
      users = db.all(`SELECT u.id, u.full_name, u.username, u.role, s.name as school_name FROM users u LEFT JOIN schools s ON u.school_id = s.id WHERE u.school_id = ?`, [req.user.school_id]);
    }
    res.json({ users });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;