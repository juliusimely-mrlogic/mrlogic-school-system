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
        const token = jwt.sign({ id: user.id, role: user.role, school_id: user.school_id, name: user.full_name }, process.env.JWT_SECRET || 'siri_yako_ya_siri', { expiresIn: '1d' });
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

// API ZA WALIMU NA MAJUKUMU
app.get('/api/teachers', authenticateToken, async (req, res) => {
    try {
        const user = req.user; let query = `SELECT * FROM teachers`; let params = [];
        if (user.role === 'super_admin') { if (req.query.school_id) { query += ` WHERE school_id = $1`; params.push(req.query.school_id); } } 
        else { if (!user.school_id) return res.status(400).json({ error: "Hana shule" }); query += ` WHERE school_id = $1`; params.push(user.school_id); }
        query += ` ORDER BY full_name ASC`; const result = await pool.query(query, params); res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.post('/api/teachers', authenticateToken, async (req, res) => {
    const { full_name, gender, phone, designation } = req.body; 
    const user = req.user;
    if (!user.school_id) return res.status(400).json({ error: "Hana shule" });
    const client = await pool.connect();
    try {
        let nameParts = full_name.trim().toLowerCase().split(/\s+/);
        let firstName = nameParts[0] || '';
        let lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
        let baseUsername = (firstName + lastName).replace(/[^a-z0-9]/g, '');
        if (!baseUsername) baseUsername = "teacher";
        let username = baseUsername; let counter = 1;
        let checkUser = await client.query('SELECT * FROM users WHERE username = $1', [username]);
        while (checkUser.rows.length > 0) { username = baseUsername + counter; counter++; checkUser = await client.query('SELECT * FROM users WHERE username = $1', [username]); }
        await client.query('BEGIN');
        const query = `INSERT INTO teachers (full_name, gender, phone, username, school_id, designation) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
        const result = await client.query(query, [full_name, gender, phone, username, user.school_id, designation || 'Mwalimu']);
        const salt = await bcrypt.genSalt(10); const hashedPassword = await bcrypt.hash('password123', salt);
        await client.query(`INSERT INTO users (full_name, username, password_hash, role, school_id) VALUES ($1, $2, $3, $4, $5)`, [full_name, username, hashedPassword, 'teacher', user.school_id]);
        await client.query('COMMIT');
        res.status(201).json({ ...result.rows[0], username });
    } catch (error) { 
        await client.query('ROLLBACK');
        res.status(500).json({ error: "Imeshindikana. Hakikisha column 'designation' ipo." }); 
    } finally { client.release(); }
});

app.put('/api/teachers/:id', authenticateToken, async (req, res) => {
    const { id } = req.params; const { full_name, gender, phone, designation } = req.body; const user = req.user;
    try {
        let query = `UPDATE teachers SET full_name=$1, gender=$2, phone=$3, designation=$4 WHERE id=$5`; 
        let params = [full_name, gender, phone, designation, id];
        if (user.role !== 'super_admin') { query += ` AND school_id=$6`; params.push(user.school_id); }
        query += ` RETURNING *`; const result = await pool.query(query, params);
        if (result.rowCount === 0) return res.status(404).json({ error: "Hajapatikana" });
        res.json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.delete('/api/teachers/:id', authenticateToken, async (req, res) => {
    const { id } = req.params; const user = req.user;
    try {
        let query = `DELETE FROM teachers WHERE id=$1`; let params = [id];
        if (user.role !== 'super_admin') { query += ` AND school_id=$2`; params.push(user.school_id); }
        const result = await pool.query(query, params);
        if (result.rowCount === 0) return res.status(404).json({ error: "Hajapatikana" });
        res.json({ message: "Amefutwa" });
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

// API ZA DATA MSINGI (WANAFUNZI, MADARASA, MASOMO, MITIHANI)
app.get('/api/students', authenticateToken, async (req, res) => {
    try {
        const user = req.user; let query = `SELECT id, full_name, gender, stream_id, admission_number FROM students`; let params = [], conditions = [];
        if (user.role === 'super_admin') { if (req.query.school_id) { conditions.push(`school_id = $${params.length + 1}`); params.push(req.query.school_id); } } 
        else { if (!user.school_id) return res.status(400).json({ error: "Mtumiaji hana shule" }); conditions.push(`school_id = $${params.length + 1}`); params.push(user.school_id); }
        if (req.query.stream_id) { conditions.push(`stream_id = $${params.length + 1}`); params.push(req.query.stream_id); }
        if (conditions.length > 0) { query += ` WHERE ` + conditions.join(' AND '); }
        query += ` ORDER BY full_name ASC`;
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana kuleta wanafunzi" }); }
});

app.get('/api/streams', authenticateToken, async (req, res) => {
    try {
        const user = req.user; let query = `SELECT * FROM streams`; let params = [];
        if (user.role === 'super_admin') { if (req.query.school_id) { query += ` WHERE school_id = $1`; params.push(req.query.school_id); } } 
        else { if (!user.school_id) return res.status(400).json({ error: "Hana shule" }); query += ` WHERE school_id = $1`; params.push(user.school_id); }
        query += ` ORDER BY name ASC`; const result = await pool.query(query, params); res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/subjects', authenticateToken, async (req, res) => {
    try {
        const user = req.user; let query = `SELECT * FROM subjects`; let params = [];
        if (user.role === 'super_admin') { if (req.query.school_id) { query += ` WHERE school_id = $1`; params.push(req.query.school_id); } } 
        else { if (!user.school_id) return res.status(400).json({ error: "Hana shule" }); query += ` WHERE school_id = $1`; params.push(user.school_id); }
        query += ` ORDER BY name ASC`; const result = await pool.query(query, params); res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/exams', authenticateToken, async (req, res) => {
    try {
        const user = req.user; let query = `SELECT id, name, is_locked FROM exams`; let params = [];
        if (user.role === 'super_admin') { if (req.query.school_id) { query += ` WHERE school_id = $1`; params.push(req.query.school_id); } } 
        else { if (!user.school_id) return res.status(400).json({ error: "Hana shule" }); query += ` WHERE school_id = $1`; params.push(user.school_id); }
        query += ` ORDER BY id DESC`; const result = await pool.query(query, params); res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

// API YA KUHIFADHI ALAMA KWA MKONO (POST)
app.post('/api/results', authenticateToken, async (req, res) => {
    const { exam_id, subject_id, marks } = req.body; const user = req.user;
    if (!user.school_id) return res.status(400).json({ error: "Hana shule" });
    try {
        const examStatus = await pool.query('SELECT is_locked FROM exams WHERE id = $1', [exam_id]);
        if (examStatus.rows.length > 0 && examStatus.rows[0].is_locked) return res.status(403).json({ error: "Matokeo yamefungwa." });

        for (let record of marks) {
            if (record.score !== '' && record.score !== null) {
                const scoreVal = parseFloat(record.score);
                if (scoreVal < 0 || scoreVal > 100) return res.status(400).json({ error: "Alama hazipaswi kuzidi 100 au kuwa chini ya 0." });
            }
        }
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM results WHERE exam_id = $1 AND subject_id = $2 AND school_id = $3', [exam_id, subject_id, user.school_id]);
            for (let record of marks) { 
                if (record.score !== '' && record.score !== null) { 
                    await client.query('INSERT INTO results (student_id, exam_id, subject_id, score, school_id) VALUES ($1, $2, $3, $4, $5)', [record.student_id, exam_id, subject_id, record.score, user.school_id]); 
                } 
            }
            await client.query('COMMIT'); res.json({ message: "Yamehifadhiwa" });
        } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

// API MPYA: KUPATA TEMPLATE YA EXCEL (BLANK)
app.get('/api/results/excel-template', async (req, res) => {
    const token = req.query.token;
    if (!token) return res.status(401).send("Hakuna token");
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'siri_yako_ya_siri');
        if (decoded.role !== 'mtaaluma' && decoded.role !== 'mtaaluma_mkuu' && decoded.role !== 'super_admin') return res.status(403).send("Hauna ruhusa.");
        const subjectsRes = await pool.query(`SELECT name FROM subjects WHERE school_id = $1 ORDER BY name ASC`, [decoded.school_id]);
        const subjects = subjectsRes.rows.map(s => s.name);
        const headers = ['Jina la Mwanafunzi', 'Jinsia', ...subjects];
        const sampleRow = ['Mfano: John Doe', 'M', 80, 75, 60]; 
        while (sampleRow.length < headers.length) sampleRow.push(70); 
        const ws = xlsx.utils.aoa_to_sheet([headers, sampleRow]);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, "Template_Ya_Alama");
        const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', `attachment; filename="Template_Alama.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch (error) { res.status(500).send("Imeshindikana kutengeneza template."); }
});

// API MPYA: KUPOKEA EXCEL YA ALAMA (UPLOAD)
app.post('/api/results/upload-excel', authenticateToken, upload.single('file'), async (req, res) => {
    if (req.user.role !== 'mtaaluma' && req.user.role !== 'mtaaluma_mkuu' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: "Mtaaluma au Super Admin pekee anaruhusiwa." });
    }
    const { exam_id, stream_id } = req.body; const user = req.user;
    if (!exam_id || !stream_id) return res.status(400).json({ error: "Chagua Mtihani na Darasa." });
    if (!req.file) return res.status(400).json({ error: "Pakia faili la Excel." });

    try {
        const examStatus = await pool.query('SELECT is_locked FROM exams WHERE id = $1', [exam_id]);
        if (examStatus.rows.length > 0 && examStatus.rows[0].is_locked) return res.status(403).json({ error: "Matokeo yamefungwa." });

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        if (data.length === 0) return res.status(400).json({ error: "Faili ni tupu." });

        const subjectsRes = await pool.query(`SELECT id, name FROM subjects WHERE school_id = $1`, [user.school_id]);
        const subjectMap = {}; subjectsRes.rows.forEach(s => subjectMap[s.name.toLowerCase()] = s.id);

        let successCount = 0; let errors = [];
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (let row of data) {
                const studentName = row['Jina la Mwanafunzi'] ? row['Jina la Mwanafunzi'].trim() : null;
                const gender = row['Jinsia'] ? row['Jinsia'].trim().toUpperCase() : 'M';
                if (!studentName || studentName === 'Mfano: John Doe') continue; 

                const studentRes = await client.query(`SELECT id FROM students WHERE LOWER(full_name) = LOWER($1) AND gender = $2 AND stream_id = $3 AND school_id = $4`, [studentName, gender, stream_id, user.school_id]);
                if (studentRes.rows.length === 0) { errors.push(`"${studentName}" hajapatikana.`); continue; }

                const studentId = studentRes.rows[0].id;
                for (let subjectName in row) {
                    const subNameLower = subjectName.toLowerCase();
                    if (subjectMap[subNameLower]) {
                        const subjectId = subjectMap[subNameLower];
                        let score = parseFloat(row[subjectName]);
                        if (!isNaN(score)) {
                            if (score < 0) score = 0; if (score > 100) score = 100;
                            await client.query('DELETE FROM results WHERE student_id = $1 AND exam_id = $2 AND subject_id = $3', [studentId, exam_id, subjectId]);
                            await client.query('INSERT INTO results (student_id, exam_id, subject_id, score, school_id) VALUES ($1, $2, $3, $4, $5)', [studentId, exam_id, subjectId, score, user.school_id]);
                        }
                    }
                }
                successCount++;
            }
            await client.query('COMMIT');
            res.json({ message: `Imefanikiwa kupakia alama za ${successCount} wanafunzi.`, errors: errors.length > 0 ? errors : null });
        } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    } catch (error) { res.status(500).json({ error: `Imeshindikana: ${error.message}` }); }
});

app.use('/api', (req, res) => { res.status(404).json({ error: "API haipo" }); });
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));