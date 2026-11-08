const db = require('./db/database');
const { hashPassword, verifyPassword } = require('./services/authService');

const username = 'superadmin';
const password = 'Mrlogic7500@'; 

db.run(`DELETE FROM users WHERE username = ?`, [username]);
const a = hashPassword(password);

db.run(
  `INSERT INTO users (school_id, full_name, email, username, password_hash, salt, role)
   VALUES (NULL, 'Super Admin', 'admin@mrlogic.tz', ?, ?, ?, 'SUPER_ADMIN')`,
  [username, a.hash, a.salt]
);

const user = db.get('SELECT * FROM users WHERE username = ?', [username]);
if (user) {
    const isValid = verifyPassword(password, user.password_hash);
    console.log(`✅ Super Admin amesajiliwa! Password ina-match: ${isValid ? 'NDIO' : 'HAPANA'}`);
}