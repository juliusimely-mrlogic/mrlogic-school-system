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
    } catch (error) { res.status(500).json({ error: "Kuna tatizo la kiufundi" }); }
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

// ==========================================
// API YA TAARIFA (NOTIFICATIONS) - IMEREKEBISHWA
// ==========================================
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        let query = `SELECT * FROM notifications`;
        let params = [];
        
        if (user.role !== 'super_admin') {
            if (!user.school_id) return res.status(400).json({ error: "Mtumiaji hana shule" });
            query += ` WHERE school_id = $1`;
            params.push(user.school_id);
        } else if (req.query.school_id) {
            query += ` WHERE school_id = $1`;
            params.push(req.query.school_id);
        }
        
        query += ` ORDER BY created_at DESC`;
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana kuleta taarifa" }); }
});

app.post('/api/notifications', authenticateToken, async (req, res) => {
    const { title, message, target_role } = req.body;
    const user = req.user;
    
    // Kama mtumiaji hana school_id (mfano Super Admin), tunatuma null
    const finalSchoolId = user.school_id || null;

    try {
        const query = `INSERT INTO notifications (title, message, sender_name, target_role, school_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`;
        const result = await pool.query(query, [title, message, user.name, target_role || 'all', finalSchoolId]);
        res.status(201).json(result.rows[0]);
    } catch (error) { 
        // HAPA NDIPO TUNAWEKA KIOSA CHA KUTUAMBIA KOSA
        console.error("Kosa la kutuma taarifa kutoka DB:", error.message);
        res.status(500).json({ error: "Imeshindikana kutuma taarifa." }); 
    }
});

app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    try {
        let query = `DELETE FROM notifications WHERE id = $1`;
        let params = [id];
        if (user.role !== 'super_admin') { query += ` AND school_id = $2`; params.push(user.school_id); }
        const result = await pool.query(query, params);
        if (result.rowCount === 0) return res.status(404).json({ error: "Taarifa haijapatikana" });
        res.json({ message: "Taarifa imefutwa" });
    } catch (error) { res.status(500).json({ error: "Imeshindikana kufuta taarifa." }); }
});

// (API zingine za Wanafunzi, Walimu, Malipo zipo kama zilivyo)
// ... (Nakili API zote zilizobaki kutoka kwenye code uliyopewa awali) ...

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));