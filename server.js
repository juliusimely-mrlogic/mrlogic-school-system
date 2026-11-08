require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('./config');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

function loadRoute(routePath, moduleName) {
  try {
    const router = require(moduleName);
    app.use(routePath, router);
    console.log(`✅ API imeunganishwa: ${routePath}`);
  } catch (err) {
    console.error(`❌ IMESHINDWA kuunganisha API ${routePath}:`, err.message);
  }
}

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
loadRoute('/api/notifications', './routes/notifications'); // MPYA

const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));
app.use((req, res) => {
  if (req.url.startsWith('/api')) return res.status(404).json({ error: 'API haipo' });
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.status(404).send('Ukurasa haupatikani');
});

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`\n=========================================`);
  console.log(`Mfumo wa MR-LOGIC unafanya kazi kwenye: http://localhost:${PORT}`);
  console.log(`=========================================\n`);
});