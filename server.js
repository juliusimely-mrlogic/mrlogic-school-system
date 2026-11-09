require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const db = require('./db/database');
const { hashPassword } = require('./services/authService');

const app = express();

// Middleware za msingi
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// === MFUMO WA KULAZIMISHA SUPER ADMIN ===
// Hii ni muhimu sana kwa Render kwa sababu database inafutwa kila mfumo unapowaka upya
console.log('Inakagua kama Super Admin yupo...');
try {
    // Futa kama alikuwepo ili kuanza upya na kuepuka makosa ya kurudia
    db.run('DELETE FROM users WHERE username = ?', ['superadmin']);
    
    // Tengeneza mpya
    const a = hashPassword('Mrlogic7500@');
    db.run(
      `INSERT INTO users (school_id, full_name, email, username, password_hash, salt, role)
       VALUES (NULL, 'Super Admin', 'admin@mrlogic.tz', 'superadmin', ?, ?, 'SUPER_ADMIN')`,
      [a.hash, a.salt]
    );
    console.log('✅ Super Admin amewekwa tayari! (Username: superadmin, Password: Mrlogic7500@)');
} catch (error) {
    console.error('❌ KOSA LA KUTENGENEZA ADMIN:', error.message);
}
// =======================================

// Kazi ya kuunganisha API kwa usalama
function loadRoute(routePath, moduleName) {
  try {
    const router = require(moduleName);
    app.use(routePath, router);
    console.log(`✅ API imeunganishwa: ${routePath}`);
  } catch (err) {
    console.error(`❌ IMESHINDWA kuunganisha API ${routePath}:`, err.message);
  }
}

// === API ZOTE ZIMEUNGANISHWA HAPA ===
loadRoute('/api/auth', './routes/auth');
loadRoute('/api/schools', './routes/schools');
loadRoute('/api/academics', './routes/academics');
loadRoute('/api/users', './routes/users'); 
loadRoute('/api/classes', './routes/classes');
loadRoute('/api/students', './routes/students');
loadRoute('/api/attendance', './routes/attendance');
loadRoute('/api/exams', './routes/exams');
loadRoute('/api/fees', './routes/fees');
loadRoute('/api/teachers', './routes/teachers');
loadRoute('/api/notifications', './routes/notifications');
loadRoute('/api/superadmin', './routes/superadmin'); // Hii ni API mpya ya Super Admin

// === KUSOMA MAFAILI YA FRONTEND (HTML, CSS, JS) ===
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

// Fallback: Kama hakuna API au faili lililopatikana, rudisha index.html
app.use((req, res) => {
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ error: 'API haipo' });
  }
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Ukurasa haupatikani (Frontend bado haijawekwa)');
  }
});

// === KUANZISHA SERVER ===
const PORT = config.port || 10000;
app.listen(PORT, () => {
  console.log(`\n=========================================`);
  console.log(`Mfumo wa MR-LOGIC unafanya kazi kwenye: http://localhost:${PORT}`);
  console.log(`=========================================\n`);
});