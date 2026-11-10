const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const pool = require('./db'); // Hakikisha connection yako ya PostgreSQL ipo

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware ya Usalama (Auth)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: "Hakuna token" });

    jwt.verify(token, process.env.JWT_SECRET || 'siri_yako_ya_siri', (err, user) => {
        if (err) return res.status(403).json({ error: "Token si sahihi" });
        req.user = user; // Hapa tunapata id, role, na school_id ya aliyelogin
        next();
    });
};

// API ya Kupata Takwimu za Dashibodi
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        let targetSchoolId;
        let schoolName = "";

        // 1. Logic ya Kuchagua Shule
        if (user.role === 'super_admin') {
            // Super Admin anatumia ile ID aliyoichagua kwenye dropdown
            targetSchoolId = req.query.school_id;
            if (!targetSchoolId) {
                return res.json({ totalStudents: 0, totalTeachers: 0, totalClasses: 0, totalFees: 0, schoolName: "Chagua Shule" });
            }
        } else if (user.role === 'school_manager') {
            // Mkuu wa Shule analazimishwa kutumia shule yake mwenyewe (Hata akibadilisha URL haitafanya kazi)
            targetSchoolId = user.school_id;
        } else {
            return res.status(403).json({ error: "Hauna ruhusa kuona takwimu hizi" });
        }

        // 2. Pata Jina la Shule
        const schoolQuery = `SELECT name FROM schools WHERE id = $1`;
        const schoolResult = await pool.query(schoolQuery, [targetSchoolId]);
        if (schoolResult.rows.length > 0) {
            schoolName = schoolResult.rows[0].name;
        }

        // 3. Fanya Mahesabu (Queries)
        // Badilisha 'students', 'teachers', 'classes', 'payments' kama majina ya tables zako yalivyo
        const studentsQuery = `SELECT COUNT(*) FROM students WHERE school_id = $1`;
        const teachersQuery = `SELECT COUNT(*) FROM teachers WHERE school_id = $1`;
        const classesQuery = `SELECT COUNT(*) FROM classes WHERE school_id = $1`;
        const feesQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE school_id = $1`;

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
        console.error("Kosa kwenye Dashboard:", error);
        res.status(500).json({ error: "Imeshindikana kupata takwimu" });
    }
});

// API ya kuleta shule zote (Kwa ajili ya Super Admin Dropdown)
app.get('/api/schools', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa" });
    try {
        const result = await pool.query('SELECT id, name FROM schools ORDER BY name ASC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: "Imeshindikana kuleta shule" });
    }
});

// Kumalizia mfumo
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server inakimbia kwenye port ${PORT}`));