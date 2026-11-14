const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const bcrypt = require('bcryptjs'); 
const multer = require('multer');
const xlsx = require('xlsx');
const pool = require('./db'); 

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const getGradeAndPoints = (score) => {
    if (score >= 75) return { grade: 'A', points: 1 };
    if (score >= 65) return { grade: 'B', points: 2 };
    if (score >= 45) return { grade: 'C', points: 3 };
    if (score >= 30) return { grade: 'D', points: 4 };
    return { grade: 'F', points: 5 };
};

const getDivision = (points) => {
    if (points >= 7 && points <= 17) return 'I';
    if (points >= 18 && points <= 21) return 'II';
    if (points >= 22 && points <= 25) return 'III';
    if (points >= 26 && points <= 33) return 'IV';
    return '0';
};

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) return res.status(401).json({ error: "Jina la mtumiaji si sahihi" });

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(401).json({ error: "Password si sahihi" });

        const token = jwt.sign(
            { id: user.id, role: user.role, school_id: user.school_id, name: user.full_name },
            process.env.JWT_SECRET || 'siri_yako_ya_siri',
            { expiresIn: '1d' }
        );
        res.json({ token, user });
    } catch (error) { res.status(500).json({ error: "Kuna tatizo la kiufundi" }); }
});

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Hakuna token" });

    jwt.verify(token, process.env.JWT_SECRET || 'siri_yako_ya_siri', (err, user) => {
        if (err) return res.status(401).json({ error: "Token imeisha muda au si sahihi" });
        req.user = user; 
        next();
    });
};

// ... (API zingine zote za Dashboard, Students, Teachers, Fees zipo hapa kama zamani) ...
// KWA UFUPI: Nimeweka API mpya chini kabisa kabla ya app.get('*')

// ==========================================
// API MPYA: KUPATA TEMPLATE YA EXCEL (BLANK)
// ==========================================
app.get('/api/results/excel-template', authenticateToken, async (req, res) => {
    if (req.user.role !== 'mtaaluma' && req.user.role !== 'mtaaluma_mkuu' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: "Hauna ruhusa ya kupakua template hii." });
    }

    try {
        // 1. Pata masomo yote ya shule hii
        const subjectsRes = await pool.query(`SELECT name FROM subjects WHERE school_id = $1 ORDER BY name ASC`, [req.user.school_id]);
        const subjects = subjectsRes.rows.map(s => s.name);

        // 2. Tengeneza vichwa vya safu (Headers): Jina, Jinsia, Somo1, Somo2...
        const headers = ['Jina la Mwanafunzi', 'Jinsia', ...subjects];
        
        // 3. Tengeneza mfano wa safu moja
        const sampleRow = ['Mfano: John Doe', 'M', 80, 75, 60]; // Nimeweka mfano wa alama
        while (sampleRow.length < headers.length) sampleRow.push(70); // Jaza masomo mengine na alama ya mfano

        // 4. Tengeneza Excel
        const ws = xlsx.utils.aoa_to_sheet([headers, sampleRow]);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, "Template_Ya_Alama");
        const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', `attachment; filename="Template_Alama_${req.user.school_id}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Imeshindikana kutengeneza template." });
    }
});

// ==========================================
// API MPYA: KUPOKEA EXCEL YA ALAMA (UPLOAD)
// ==========================================
app.post('/api/results/upload-excel', authenticateToken, upload.single('file'), async (req, res) => {
    if (req.user.role !== 'mtaaluma' && req.user.role !== 'mtaaluma_mkuu' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: "Mtaaluma au Super Admin pekee anaruhusiwa kupakia alama." });
    }

    const { exam_id, stream_id } = req.body;
    const user = req.user;

    if (!exam_id || !stream_id) return res.status(400).json({ error: "Chagua Mtihani na Darasa kwanza." });
    if (!req.file) return res.status(400).json({ error: "Tafadhali pakia faili la Excel." });

    try {
        // Kagua kama mtihani umefungwa
        const examStatus = await pool.query('SELECT is_locked FROM exams WHERE id = $1', [exam_id]);
        if (examStatus.rows.length > 0 && examStatus.rows[0].is_locked) {
            return res.status(403).json({ error: "Matokeo yamefungwa. Huwezi kupakia mabadiliko." });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        
        if (data.length === 0) return res.status(400).json({ error: "Faili la Excel ni tupu." });

        // Pata masomo yote ya shule
        const subjectsRes = await pool.query(`SELECT id, name FROM subjects WHERE school_id = $1`, [user.school_id]);
        const subjectMap = {}; 
        subjectsRes.rows.forEach(s => subjectMap[s.name.toLowerCase()] = s.id);

        let successCount = 0;
        let errors = [];
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            for (let row of data) {
                const studentName = row['Jina la Mwanafunzi'] ? row['Jina la Mwanafunzi'].trim() : null;
                const gender = row['Jinsia'] ? row['Jinsia'].trim().toUpperCase() : 'M';

                if (!studentName) {
                    errors.push("Safu iliyokosa jina imerukwa.");
                    continue;
                }

                // 1. Tafuta mwanafunzi kwa Jina, Jinsia na Darasa
                const studentRes = await client.query(
                    `SELECT id FROM students WHERE LOWER(full_name) = LOWER($1) AND gender = $2 AND stream_id = $3 AND school_id = $4`,
                    [studentName, gender, stream_id, user.school_id]
                );

                if (studentRes.rows.length === 0) {
                    errors.push(`Mwanafunzi "${studentName}" hajapatikana kwenye darasa hili.`);
                    continue;
                }

                const studentId = studentRes.rows[0].id;

                // 2. Pitia masomo yote yaliyopo kwenye Excel
                for (let subjectName in row) {
                    const subNameLower = subjectName.toLowerCase();
                    // Kama safu hii ni somo (ipo kwenye database)
                    if (subjectMap[subNameLower]) {
                        const subjectId = subjectMap[subNameLower];
                        let score = parseFloat(row[subjectName]);

                        if (!isNaN(score)) {
                            if (score < 0) score = 0;
                            if (score > 100) score = 100;

                            // Hifadhi au Sasisha alama (Tumia ON CONFLICT kama una unique constraint, au DELETE + INSERT)
                            await client.query('DELETE FROM results WHERE student_id = $1 AND exam_id = $2 AND subject_id = $3', [studentId, exam_id, subjectId]);
                            await client.query(
                                'INSERT INTO results (student_id, exam_id, subject_id, score, school_id) VALUES ($1, $2, $3, $4, $5)',
                                [studentId, exam_id, subjectId, score, user.school_id]
                            );
                        }
                    }
                }
                successCount++;
            }

            await client.query('COMMIT');
            res.json({ 
                message: `Imefanikiwa kupakia alama za wanafunzi ${successCount}.`, 
                errors: errors.length > 0 ? errors : null 
            });

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error("Excel Upload Error:", error);
        res.status(500).json({ error: `Imeshindikana kupakia faili: ${error.message}` });
    }
});

// ... (Weka API zingine zote za Walimu, Malipo, n.k. kama zilivyokuwa) ...
// ... (Weka app.use('/api', ...) na app.get('*', ...) mwishoni) ...

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));