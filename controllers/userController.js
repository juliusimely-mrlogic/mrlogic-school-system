const db = require('../db/database');
const { hashPassword } = require('../services/authService');

// Kusajili mtumiaji mpya (Mwalimu, Mkuu wa Shule, n.k.)
exports.createUser = (req, res) => {
  try {
    const { school_id, full_name, email, username, password, role } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Username, password na role vinahitajika' });
    }

    const existing = db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: 'Jina la mtumiaji (username) tayari lipo' });
    }

    const auth = hashPassword(password);
    const result = db.run(
      `INSERT INTO users (school_id, full_name, email, username, password_hash, salt, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [school_id || null, full_name, email, username, auth.hash, auth.salt, role]
    );

    const newUser = db.get('SELECT id, username, role, school_id FROM users WHERE username = ?', [username]);
    res.status(201).json({ message: 'Mtumiaji amesajiliwa kikamilifu', user: newUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Kupata watumiaji wote (unaweza kuchuja kwa school_id)
exports.getUsers = (req, res) => {
  try {
    const { school_id } = req.query;
    let query = 'SELECT id, full_name, username, email, role, school_id FROM users';
    let params = [];

    if (school_id) {
      query += ' WHERE school_id = ?';
      params.push(school_id);
    }

    const users = db.all(query, params);
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Kuhariri mtumiaji
exports.updateUser = (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, role } = req.body;

    const user = db.get('SELECT id FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ error: 'Mtumiaji hakupatikana' });

    db.run(
      `UPDATE users SET full_name = COALESCE(?, full_name), email = COALESCE(?, email), role = COALESCE(?, role) WHERE id = ?`,
      [full_name, email, role, id]
    );

    res.json({ message: 'Taarifa za mtumiaji zimebadilishwa' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Kufuta mtumiaji
exports.deleteUser = (req, res) => {
  try {
    const { id } = req.params;
    db.run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'Mtumiaji amefutwa' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};