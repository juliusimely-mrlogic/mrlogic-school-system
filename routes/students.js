const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');
const multer = require('multer');
const xlsx = require('xlsx');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post('/', authenticate, async (req, res) => {
  const { school_id, class_id, full_name, gender, admission_number, parent_phone } = req.body;
  if (!school_id || !class_id || !full_name || !admission_number) return res.status(400).json({ error: 'Taarifa hazijakamilika' });
  try {
    await db.run(`INSERT INTO students (school_id, class_id, full_name, gender, admission_number, parent_phone) VALUES (?, ?, ?, ?, ?, ?)`, [school_id, class_id, full_name, gender, admission_number, parent_phone || null]);
    res.status(201).json({ message: 'Mwanafunzi amesajiliwa' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/bulk', authenticate, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Hakuna faili lililopakiwa' });
    
    const { school_id, class_id } = req.body;
    if (!school_id || !class_id) return res.status(400).json({ error: 'Chagua darasa na shule kwanza' });

    try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        if (data.length === 0) return res.status(400).json({ error: 'Faili ni tupu au halina muundo sahihi' });

        let insertedCount = 0;
        
        for (const row of data) {
            // HAPA NDIO TUNAFANYA MABADILIKO: Tunabadilisha vichwa vyote kuwa herufi ndogo
            // Ili iwe JINA, Jina, au jina, mfumo utavisoma sawa.
            const normalizedRow = {};
            Object.keys(row).forEach(key => {
                normalizedRow[key.trim().toLowerCase()] = row[key];
            });

            const full_name = normalizedRow['jina'] || normalizedRow['name'] || normalizedRow['full name'] || normalizedRow['full_name'];
            const admission_number = normalizedRow['namba'] || normalizedRow['admission'] || normalizedRow['adm'] || normalizedRow['admission_number'];
            const gender = normalizedRow['jinsia'] || normalizedRow['gender'] || 'M';
            const parent_phone = normalizedRow['simu'] || normalizedRow['phone'] || normalizedRow['parent phone'] || normalizedRow['parent_phone'] || null;

            if (full_name && admission_number) {
                const existing = await db.get('SELECT id FROM students WHERE admission_number = ? AND school_id = ?', [admission_number, school_id]);
                
                if (!existing) {
                    await db.run(
                        `INSERT INTO students (school_id, class_id, full_name, gender, admission_number, parent_phone) VALUES (?, ?, ?, ?, ?, ?)`,
                        [school_id, class_id, full_name, gender, admission_number, parent_phone]
                    );
                    insertedCount++;
                }
            }
        }

        res.status(200).json({ message: `Wanafunzi ${insertedCount} wameingizwa kikamilifu kwenye mfumo!` });
    } catch (err) {
        console.error("Kosa la Excel:", err);
        res.status(500).json({ error: 'Kosa la kusoma faili: ' + err.message });
    }
});

router.get('/', authenticate, async (req, res) => {
  const { school_id, class_id } = req.query;
  let query = 'SELECT * FROM students WHERE school_id = ?';
  let params = [school_id];
  if (class_id) { query += ' AND class_id = ?'; params.push(class_id); }
  try {
    const students = await db.all(query, params);
    res.json({ students });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await db.run('DELETE FROM students WHERE id = ?', [req.params.id]);
    res.json({ message: 'Mwanafunzi amefutwa' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;