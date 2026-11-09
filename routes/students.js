const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');
const multer = require('multer');
const xlsx = require('xlsx');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post('/', authenticate, async (req, res) => {
  if (req.user.role === 'TEACHER') return res.status(403).json({ error: 'Mwalimu hawezi kusajili mwanafunzi.' });
  const { school_id, class_id, full_name, gender, admission_number, parent_phone } = req.body;
  if (!school_id || !class_id || !full_name || !admission_number) return res.status(400).json({ error: 'Taarifa hazijakamilika' });
  try {
    await db.run(`INSERT INTO students (school_id, class_id, full_name, gender, admission_number, parent_phone) VALUES (?, ?, ?, ?, ?, ?)`, [school_id, class_id, full_name, gender, admission_number, parent_phone || null]);
    res.status(201).json({ message: 'Mwanafunzi amesajiliwa' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/bulk', authenticate, upload.single('file'), async (req, res) => {
    if (req.user.role === 'TEACHER') return res.status(403).json({ error: 'Mwalimu hawezi kupakia Excel.' });
    if (!req.file) return res.status(400).json({ error: 'Hakuna faili lililopakiwa' });
    const { school_id, class_id } = req.body;
    if (!school_id || !class_id) return res.status(400).json({ error: 'Chagua darasa na shule kwanza' });

    try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        let insertedCount = 0;
        for (const row of data) {
            const normalizedRow = {};
            Object.keys(row).forEach(key => { normalizedRow[key.trim().toLowerCase()] = row[key]; });

            const full_name = normalizedRow['jina'] || normalizedRow['name'] || normalizedRow['full_name'];
            const admission_number = normalizedRow['namba'] || normalizedRow['admission'] || normalizedRow['adm'] || normalizedRow['admission_number'];
            const gender = normalizedRow['jinsia'] || normalizedRow['gender'] || 'M';
            const parent_phone = normalizedRow['simu'] || normalizedRow['phone'] || normalizedRow['parent_phone'] || null;

            if (full_name && admission_number) {
                const existing = await db.get('SELECT id FROM students WHERE admission_number = ? AND school_id = ?', [admission_number, school_id]);
                if (!existing) {
                    await db.run(`INSERT INTO students (school_id, class_id, full_name, gender, admission_number, parent_phone) VALUES (?, ?, ?, ?, ?, ?)`, [school_id, class_id, full_name, gender, admission_number, parent_phone]);
                    insertedCount++;
                }
            }
        }
        res.status(200).json({ message: `Wanafunzi ${insertedCount} wameingizwa kikamilifu!` });
    } catch (err) { res.status(500).json({ error: 'Kosa la kusoma faili: ' + err.message }); }
});

router.get('/', authenticate, async (req, res) => {
  const { school_id, class_id } = req.query;
  try {
    let students;
    if (req.user.role === 'TEACHER' && req.user.teacher_id) {
        // Mwalimu anaona wanafunzi wa madarasa aliyopangiwa
        students = await db.all(`
            SELECT DISTINCT s.* FROM students s
            JOIN teacher_assignments ta ON s.class_id = ta.class_id
            WHERE ta.teacher_id = ?
        `, [req.user.teacher_id]);
    } else {
        let query = 'SELECT * FROM students WHERE school_id = ?';
        let params = [school_id];
        if (class_id) { query += ' AND class_id = ?'; params.push(class_id); }
        students = await db.all(query, params);
    }
    res.json({ students });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  if (req.user.role === 'TEACHER') return res.status(403).json({ error: 'Mwalimu hawezi kufuta mwanafunzi.' });
  try {
    await db.run('DELETE FROM students WHERE id = ?', [req.params.id]);
    res.json({ message: 'Mwanafunzi amefutwa' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;