const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { hashPassword } = require('../services/authService');
const authenticate = require('../middlewares/authMiddleware');

router.post('/', authenticate, async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'SCHOOL_MANAGER') return res.status(403).json({ error: 'Hauna ruhusa' });
  
  const { school_id, full_name, role, teacher_id } = req.body;
  if (!full_name || !role) return res.status(400).json({ error: 'Taarifa hazijakamilika' });
  
  try {
    let baseUsername = full_name.toLowerCase().replace(/\s+/g, ''); 
    let username = baseUsername;
    let counter = 1;
    
    while (await db.get('SELECT id FROM users WHERE username = ?', [username])) {
        username = `${baseUsername}${counter}`;
        counter++;
    }

    const defaultPassword = '1000';
    const { hash, salt } = hashPassword(defaultPassword);
    const finalSchoolId = (req.user.role === 'SCHOOL_MANAGER') ? req.user.school_id : (school_id || null);

    await db.run(`INSERT INTO users (school_id, teacher_id, full_name, username, password_hash, salt, role, is_password_changed) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`, 
      [finalSchoolId, teacher_id || null, full_name, username, hash, salt, role]);
    
    res.status(201).json({ message: 'Mtumiaji amesajiliwa', user: { username, defaultPassword } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', authenticate, async (req, res) => {
  try {
    let users;
    if (req.user.role === 'SUPER_ADMIN') {
      users = await db.all(`SELECT u.id, u.full_name, u.username, u.role, u.teacher_id, s.name as school_name FROM users u LEFT JOIN schools s ON u.school_id = s.id`);
    } else {
      users = await db.all(`SELECT u.id, u.full_name, u.username, u.role, u.teacher_id, s.name as school_name FROM users u LEFT JOIN schools s ON u.school_id = s.id WHERE u.school_id = ?`, [req.user.school_id]);
    }
    res.json({ users });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;