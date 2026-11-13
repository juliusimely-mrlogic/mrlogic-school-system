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
            schoolName: schoolName,
            totalStudents: parseInt(students.rows[0].count),
            totalTeachers: parseInt(teachers.rows[0].count),
            totalClasses: parseInt(classes.rows[0].count),
            totalFees: parseFloat(fees.rows[0].total),
            role: user.role
        });
    } catch (error) {
        res.status(500).json({ error: "Imeshindikana kupata takwimu" });
    }
});

// 3. API YA WANAFUNZI
app.get('/api/students', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        let query = `SELECT id, full_name, gender, stream_id, admission_number FROM students`;
        let params = [];

        if (user.role === 'super_admin') {
            if (req.query.school_id) {
                query += ` WHERE school_id = $1`;
                params.push(req.query.school_id);
            }
        } else {
            if (!user.school_id) return res.status(400).json({ error: "Mtumiaji hana shule" });
            query += ` WHERE school_id = $1`;
            params.push(user.school_id);
        }
        
        query += ` ORDER BY full_name ASC`;
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: "Imeshindikana kuleta wanafunzi" });
    }
});

// 4. API YA WALIMU
app.get('/api/teachers', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        let query = `SELECT * FROM teachers`;
        let params = [];

        if (user.role === 'super_admin') {
            if (req.query.school_id) {
                query += ` WHERE school_id = $1`;
                params.push(req.query.school_id);
            }
        } else {
            if (!user.school_id) return res.status(400).json({ error: "Mtumiaji hana shule" });
            query += ` WHERE school_id = $1`;
            params.push(user.school_id);
        }
        
        query += ` ORDER BY full_name ASC`; 
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error("Kosa la kuleta walimu:", error); 
        res.status(500).json({ error: "Imeshindikana kuleta orodha ya walimu" });
    }
});

// 5. API MPYA: KUHIFADHI MAHUDHURIO
app.post('/api/attendance', authenticateToken, async (req, res) => {
    const { records, date } = req.body;
    const user = req.user;

    if (!user.school_id) return res.status(400).json({ error: "Mtumiaji hana shule" });

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Futa mahudhurio ya siku hiyo kwanza ili kuepuka marudio (upsert logic)
            await client.query('DELETE FROM attendance WHERE date = $1 AND school_id = $2', [date, user.school_id]);

            // Ingiza mahudhurio mapya
            for (let record of records) {
                await client.query(
                    'INSERT INTO attendance (student_id, date, status, school_id) VALUES ($1, $2, $3, $4)',
                    [record.student_id, date, record.status, user.school_id]
                );
            }
            
            await client.query('COMMIT');
            res.json({ message: "Mahudhurio yamehifadhiwa kikamilifu" });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Kosa la kuhifadhi mahudhurio:", error);
        res.status(500).json({ error: "Imeshindikana kuhifadhi mahudhurio" });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));