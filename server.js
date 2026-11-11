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
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Jina la mtumiaji si sahihi" });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: "Password si sahihi" });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, school_id: user.school_id, name: user.full_name },
            process.env.JWT_SECRET || 'siri_yako_ya_siri',
            { expiresIn: '1d' }
        );

        res.json({ token, user });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ error: "Kuna tatizo la kiufundi" });
    }
});

// Middleware ya Usalama
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Hakuna token" });

    jwt.verify(token, process.env.JWT_SECRET || 'siri_yako_ya_siri', (err, user) => {
        if (err) return res.status(403).json({ error: "Token si sahihi" });
        req.user = user; 
        next();
    });
};

// 2. API YA TAKWIMU ZA DASHIBODI
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        let targetSchoolId = user.role === 'super_admin' ? req.query.school_id : user.school_id;
        
        if (!targetSchoolId) {
            return res.json({ totalStudents: 0, totalTeachers: 0, totalClasses: 0, totalFees: 0, schoolName: "Chagua Shule" });
        }

        // Pata jina la shule
        const schoolResult = await pool.query(`SELECT name FROM schools WHERE id = $1`, [targetSchoolId]);
        const schoolName = schoolResult.rows.length > 0 ? schoolResult.rows[0].name : "Shule Haijulikani";

        // Hesabu takwimu (Tumia majina ya tables yaliyopo kwenye DB yako)
        const studentsQuery = `SELECT COUNT(*) FROM students WHERE school_id = $1`;
        const teachersQuery = `SELECT COUNT(*) FROM teachers WHERE school_id = $1`;
        // Kama table yako ya madarasa inaitwa 'streams' badilisha hapa chini:
        const classesQuery = `SELECT COUNT(*) FROM streams WHERE school_id = $1`; 
        // Kama table ya malipo inaitwa 'fees' badilisha hapa chini:
        const feesQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM fees WHERE school_id = $1`;

        const [students, teachers, classes, fees] = await Promise.all([
            pool.query(studentsQuery, [targetSchoolId]),
            pool.query(teachersQuery, [targetSchoolId]),
            pool.query(classesQuery, [targetSchoolId]),
            pool.query(feesQuery, [targetSchoolId])
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
        console.error("Database Error kwenye Stats:", error);
        res.status(500).json({ error: "Imeshindikana kupata takwimu" });
    }
});

// 3. API YA KULETA SHULE (Kwa Super Admin)
app.get('/api/schools', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa" });
    try {
        const result = await pool.query('SELECT id, name FROM schools ORDER BY name ASC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: "Imeshindikana kuleta shule" });
    }
});

// Catch-all route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));