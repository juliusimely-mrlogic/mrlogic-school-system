const express = require('express');
const router = express.Router();
const db = require('../db/database');
const authenticate = require('../middlewares/authMiddleware');
const multer = require('multer');
const xlsx = require('xlsx');

// Setup multer kwa ajili ya kupokea faili kwenye memory
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// POST: Kusajili mwanafunzi mmoja (kama ilivyokuwa)
router.post('/', authenticate, async (req, res) => {
  const { school_id, class_id, full_name, gender, admission_number, parent_phone } = req.body;
  if (!school_id || !class_id || !full_name || !admission_number) return res.status(400).json({ error: 'Taarifa hazijakamilika' });
  try {
    await db.run(`INSERT INTO students (school_id, class_id, full_name, gender, admission_number, parent_phone) VALUES (?, ?, ?, ?, ?, ?)`, [school_id, class_id, full_name, gender, admission_number, parent_phone || null]);
    res.status(201).json({ message: 'Mwanafunzi amesajiliwa' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST: Kupakia Wanafunzi kwa Excel (Bulk Upload)
router.post('/bulk', authenticate, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Hakuna faili lililopakiwa' });
    
    const { school_id, class_id } = req.body;
    if (!school_id || !class_id) return res.status(400).json({ error: 'Chagua darasa na shule kwanza' });

    try {
        // Soma faili la Excel
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        if (data.length === 0) return res.status(400).json({ error: 'Faili ni tupu au halina muundo sahihi' });

        let insertedCount = 0;
        
        for (const row of data) {
            // Tunatafuta majina ya vichwa (Headers) tofauti ili kurahisisha mtumiaji
            const full_name = row['Jina'] || row['Name'] || row['Full Name'] || row['full_name'];
            const admission_number = row['Namba'] || row['Admission'] || row['Adm'] || row['admission_number'];
            const gender = row['Jinsia'] || row['Gender'] || row['gender'] || 'M';
            const parent_phone = row['Simu'] || row['Phone'] || row['Parent Phone'] || row['parent_phone'] || null;

            if (full_name && admission_number) {
                // Kagua kama mwanafunzi yupo (kwa kutumia admission_number)
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

// GET: Kuvuta wanafunzi
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

// DELETE: Kufuta mwanafunzi
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await db.run('DELETE FROM students WHERE id = ?', [req.params.id]);
    res.json({ message: 'Mwanafunzi amefutwa' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;