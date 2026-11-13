const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const bcrypt = require('bcryptjs'); 
const pool = require('./db'); 

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. API YA LOGIN
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
    } catch (error) {
        res.status(500).json({ error: "Kuna tatizo la kiufundi" });
    }
});

// Middleware ya Usalama
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

// 2. API YA TAKWIMU ZA DASHIBODI
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        let targetSchoolId = user.role === 'super_admin' ? req.query.school_id : user.school_id;
        if (!targetSchoolId) return res.json({ totalStudents: 0, totalTeachers: 0, totalClasses: 0, totalFees: 0, schoolName: "Chagua Shule" });

        const schoolResult = await pool.query(`SELECT name FROM schools WHERE id = $1`, [targetSchoolId]);
        const schoolName = schoolResult.rows.length > 0 ? schoolResult.rows[0].name : "Shule Haijulikani";

        const [students, teachers, classes, fees] = await Promise.all([
            pool.query(`SELECT COUNT(*) FROM students WHERE school_id = $1`, [targetSchoolId]),
            pool.query(`SELECT COUNT(*) FROM teachers WHERE school_id = $1`, [targetSchoolId]),
            pool.query(`SELECT COUNT(*) FROM streams WHERE school_id = $1`, [targetSchoolId]),
            pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM fees WHERE school_id = $1`, [targetSchoolId])
        ]);

        res.json({
            schoolName: schoolName, totalStudents: parseInt(students.rows[0].count),
            totalTeachers: parseInt(teachers.rows[0].count), totalClasses: parseInt(classes.rows[0].count),
            totalFees: parseFloat(fees.rows[0].total), role: user.role
        });
    } catch (error) { res.status(500).json({ error: "Imeshindikana kupata takwimu" }); }
});

// 3. API YA WANAFUNZI
app.get('/api/students', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        let query = `SELECT id, full_name, gender, stream_id, admission_number FROM students`;
        let params = [], conditions = [];

        if (user.role === 'super_admin') {
            if (req.query.school_id) { conditions.push(`school_id = $${params.length + 1}`); params.push(req.query.school_id); }
        } else {
            if (!user.school_id) return res.status(400).json({ error: "Mtumiaji hana shule" });
            conditions.push(`school_id = $${params.length + 1}`); params.push(user.school_id);
        }
        if (req.query.stream_id) { conditions.push(`stream_id = $${params.length + 1}`); params.push(req.query.stream_id); }
        if (conditions.length > 0) { query += ` WHERE ` + conditions.join(' AND '); }
        query += ` ORDER BY full_name ASC`;
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana kuleta wanafunzi" }); }
});

// 4. API YA WALIMU
app.get('/api/teachers', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        let query = `SELECT * FROM teachers`;
        let params = [];
        if (user.role === 'super_admin') {
            if (req.query.school_id) { query += ` WHERE school_id = $1`; params.push(req.query.school_id); }
        } else {
            if (!user.school_id) return res.status(400).json({ error: "Mtumiaji hana shule" });
            query += ` WHERE school_id = $1`; params.push(user.school_id);
        }
        query += ` ORDER BY full_name ASC`; 
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana kuleta orodha ya walimu" }); }
});

// 5. API YA MAHUDHURIO
app.post('/api/attendance', authenticateToken, async (req, res) => {
    const { records, date } = req.body;
    const user = req.user;
    if (!user.school_id) return res.status(400).json({ error: "Mtumiaji hana shule" });
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM attendance WHERE date = $1 AND school_id = $2', [date, user.school_id]);
            for (let record of records) {
                await client.query('INSERT INTO attendance (student_id, date, status, school_id) VALUES ($1, $2, $3, $4)', [record.student_id, date, record.status, user.school_id]);
            }
            await client.query('COMMIT');
            res.json({ message: "Mahudhurio yamehifadhiwa" });
        } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    } catch (error) { res.status(500).json({ error: "Imeshindikana kuhifadhi mahudhurio" }); }
});

// 6. API YA MADARASA
app.get('/api/streams', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        let query = `SELECT * FROM streams`;
        let params = [];
        if (user.role === 'super_admin') {
            if (req.query.school_id) { query += ` WHERE school_id = $1`; params.push(req.query.school_id); }
        } else {
            if (!user.school_id) return res.status(400).json({ error: "Mtumiaji hana shule" });
            query += ` WHERE school_id = $1`; params.push(user.school_id);
        }
        query += ` ORDER BY name ASC`; 
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana kuleta madarasa" }); }
});

// 7. API YA MALIPO
app.get('/api/fees', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        let query = `SELECT f.*, s.full_name as student_name FROM fees f LEFT JOIN students s ON f.student_id = s.id`;
        let params = [];
        if (user.role === 'super_admin') {
            if (req.query.school_id) { query += ` WHERE f.school_id = $1`; params.push(req.query.school_id); }
        } else {
            if (!user.school_id) return res.status(400).json({ error: "Mtumiaji hana shule" });
            query += ` WHERE f.school_id = $1`; params.push(user.school_id);
        }
        query += ` ORDER BY f.id DESC`; 
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana kuleta orodha ya malipo" }); }
});

app.post('/api/fees', authenticateToken, async (req, res) => {
    const { student_id, amount, date_paid } = req.body;
    const user = req.user;
    if (!user.school_id) return res.status(400).json({ error: "Mtumiaji hana shule" });
    try {
        const query = `INSERT INTO fees (student_id, amount, date_paid, school_id) VALUES ($1, $2, $3, $4) RETURNING *`;
        const result = await pool.query(query, [student_id, amount, date_paid, user.school_id]);
        res.status(201).json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: `Imeshindikana kurekodi malipo: ${error.message}` }); }
});

// 8. API YA MASOMO NA MITIHANI
app.get('/api/subjects', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        let query = `SELECT * FROM subjects`;
        let params = [];
        if (user.role === 'super_admin') {
            if (req.query.school_id) { query += ` WHERE school_id = $1`; params.push(req.query.school_id); }
        } else {
            if (!user.school_id) return res.status(400).json({ error: "Mtumiaji hana shule" });
            query += ` WHERE school_id = $1`; params.push(user.school_id);
        }
        query += ` ORDER BY name ASC`;
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana kuleta masomo" }); }
});

app.get('/api/exams', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        let query = `SELECT * FROM exams`;
        let params = [];
        if (user.role === 'super_admin') {
            if (req.query.school_id) { query += ` WHERE school_id = $1`; params.push(req.query.school_id); }
        } else {
            if (!user.school_id) return res.status(400).json({ error: "Mtumiaji hana shule" });
            query += ` WHERE school_id = $1`; params.push(user.school_id);
        }
        query += ` ORDER BY id DESC`;
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana kuleta mitihani" }); }
});

// 9. KUHIFADHI ALAMA
app.post('/api/results', authenticateToken, async (req, res) => {
    const { exam_id, subject_id, marks } = req.body; 
    const user = req.user;
    if (!user.school_id) return res.status(400).json({ error: "Mtumiaji hana shule" });
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM results WHERE exam_id = $1 AND subject_id = $2 AND school_id = $3', [exam_id, subject_id, user.school_id]);
            for (let record of marks) {
                if (record.score !== '' && record.score !== null) {
                    await client.query('INSERT INTO results (student_id, exam_id, subject_id, score, school_id) VALUES ($1, $2, $3, $4, $5)', [record.student_id, exam_id, subject_id, record.score, user.school_id]);
                }
            }
            await client.query('COMMIT');
            res.json({ message: "Alama zimehifadhiwa" });
        } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    } catch (error) { res.status(500).json({ error: "Imeshindikana kuhifadhi alama" }); }
});

// 10. RIPOTI (BROADSHEET)
app.get('/api/reports/broadsheet', authenticateToken, async (req, res) => {
    const { exam_id, stream_id } = req.query;
    const user = req.user;
    if (!exam_id || !stream_id) return res.status(400).json({ error: "Chagua mtihani na darasa" });
    if (!user.school_id) return res.status(400).json({ error: "Mtumiaji hana shule" });

    try {
        const studentsRes = await pool.query(`SELECT id, full_name FROM students WHERE stream_id = $1 AND school_id = $2 ORDER BY full_name ASC`, [stream_id, user.school_id]);
        const subjectsRes = await pool.query(`SELECT id, name FROM subjects WHERE school_id = $1 ORDER BY id ASC`, [user.school_id]);
        const resultsRes = await pool.query(`
            SELECT r.student_id, r.subject_id, r.score 
            FROM results r JOIN students s ON r.student_id = s.id
            WHERE r.exam_id = $1 AND s.stream_id = $2 AND r.school_id = $3
        `, [exam_id, stream_id, user.school_id]);

        const reportData = studentsRes.rows.map(student => {
            let totalScore = 0, subjectsCount = 0;
            const scores = {};
            subjectsRes.rows.forEach(sub => {
                const result = resultsRes.rows.find(r => r.student_id === student.id && r.subject_id === sub.id);
                if (result) { scores[sub.id] = parseFloat(result.score); totalScore += parseFloat(result.score); subjectsCount++; } 
                else { scores[sub.id] = '-'; }
            });
            const average = subjectsCount > 0 ? (totalScore / subjectsCount).toFixed(2) : 0;
            return { student_id: student.id, full_name: student.full_name, scores, total: totalScore, average: parseFloat(average) };
        });

        reportData.sort((a, b) => b.total - a.total);
        let currentPosition = 1;
        for (let i = 0; i < reportData.length; i++) {
            if (i > 0 && reportData[i].total < reportData[i-1].total) { currentPosition = i + 1; }
            reportData[i].position = currentPosition;
        }
        res.json({ subjects: subjectsRes.rows, reportData });
    } catch (error) { res.status(500).json({ error: "Imeshindikana kuleta ripoti" }); }
});

// ==========================================
// 11. API MPYA: USIMAMIZI WA WATUMIAJI (Super Admin Only)
// ==========================================

// Kuleta watumiaji wote
app.get('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa" });
    try {
        const result = await pool.query(`
            SELECT u.id, u.full_name, u.username, u.role, u.school_id, s.name as school_name 
            FROM users u
            LEFT JOIN schools s ON u.school_id = s.id
            ORDER BY u.id DESC
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: "Imeshindikana kuleta watumiaji" });
    }
});

// Kusajili mtumiaji mpya
app.post('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa" });
    
    const { full_name, username, password, role, school_id } = req.body;
    
    try {
        // 1. Kagua kama username imetumika
        const checkUser = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (checkUser.rows.length > 0) return res.status(400).json({ error: "Jina la mtumiaji (username) limeshatumika" });

        // 2. Fanya password kuwa hash
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Ingiza kwenye database (kama ni super_admin, school_id inaweza kuwa NULL)
        const finalSchoolId = role === 'super_admin' ? null : school_id;

        const query = `
            INSERT INTO users (full_name, username, password_hash, role, school_id) 
            VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, username, role
        `;
        const result = await pool.query(query, [full_name, username, hashedPassword, role, finalSchoolId]);
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Kosa la kusajili mtumiaji:", error);
        res.status(500).json({ error: `Imeshindikana kusajili mtumiaji: ${error.message}` });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));