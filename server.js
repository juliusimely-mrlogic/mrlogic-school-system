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
app.use(express.json({ limit: '50mb' }));
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

// ==========================================
// ANNOUNCEMENTS (LOGIN PAGE MANAGEMENT)
// ==========================================
app.get('/api/public/announcements', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const result = await pool.query(`SELECT id, message_sw, message_en FROM login_announcements WHERE is_active = true AND start_date <= $1 AND end_date >= $1 AND target_role = 'all' ORDER BY created_at DESC LIMIT 1`, [today]);
        res.json(result.rows);
    } catch (error) { res.json([]); }
});

app.get('/api/my-announcements', authenticateToken, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const result = await pool.query(`SELECT id, message_sw, message_en FROM login_announcements WHERE is_active = true AND start_date <= $1 AND end_date >= $1 AND (target_role = 'all' OR target_role = $2) ORDER BY created_at DESC LIMIT 3`, [today, req.user.role]);
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/admin/announcements', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa." });
    try {
        const result = await pool.query('SELECT * FROM login_announcements ORDER BY id DESC');
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.post('/api/admin/announcements', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa." });
    const { message_sw, message_en, target_role, start_date, end_date, is_active } = req.body;
    try {
        const result = await pool.query(`INSERT INTO login_announcements (message_sw, message_en, target_role, start_date, end_date, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [message_sw, message_en, target_role, start_date, end_date, is_active]);
        res.status(201).json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.put('/api/admin/announcements/:id/toggle', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa." });
    try {
        const result = await pool.query('UPDATE login_announcements SET is_active = NOT is_active WHERE id = $1 RETURNING *', [req.params.id]);
        res.json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.delete('/api/admin/announcements/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa." });
    try {
        await pool.query('DELETE FROM login_announcements WHERE id = $1', [req.params.id]);
        res.json({ message: "Imefutwa" });
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

// ==========================================
// LOGIN
// ==========================================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) return res.status(401).json({ error: "Jina la mtumiaji si sahihi" });
        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(401).json({ error: "Password si sahihi" });
        
        if (user.role !== 'super_admin' && user.school_id) {
            const check = await pool.query('SELECT subscription_status, trial_end_date, subscription_end_date FROM schools WHERE id = $1', [user.school_id]);
            if (check.rows.length > 0) {
                const s = check.rows[0];
                const today = new Date();
                if (s.subscription_status === 'TRIAL_ACTIVE' && s.trial_end_date && new Date(s.trial_end_date) < today) {
                    await pool.query("UPDATE schools SET subscription_status = 'TRIAL_EXPIRED' WHERE id = $1", [user.school_id]);
                } else if (s.subscription_status === 'SUBSCRIPTION_ACTIVE' && s.subscription_end_date && new Date(s.subscription_end_date) < today) {
                    await pool.query("UPDATE schools SET subscription_status = 'SUBSCRIPTION_EXPIRED' WHERE id = $1", [user.school_id]);
                }
            }
        }

        const token = jwt.sign({ id: user.id, role: user.role, school_id: user.school_id, name: user.full_name }, process.env.JWT_SECRET || 'siri_yako_ya_siri', { expiresIn: '1d' });
        res.json({ token, user });
    } catch (error) { res.status(500).json({ error: "Kuna tatizo la kiufundi" }); }
});

// ==========================================
// SUBSCRIPTION & PAYMENTS
// ==========================================
app.get('/api/subscriptions/settings', authenticateToken, async (req, res) => {
    try { const result = await pool.query('SELECT * FROM subscription_settings WHERE id = 1'); res.json(result.rows[0]); } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.put('/api/admin/subscriptions/settings', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa." });
    const { annual_fee, duration_months, trial_days, mpesa_number, tigopesa_number, airtel_number, payee_name, support_whatsapp, instructions_sw, mpesa_active, tigopesa_active, airtel_active } = req.body;
    try {
        const result = await pool.query(`
            UPDATE subscription_settings SET annual_fee=$1, duration_months=$2, trial_days=$3, mpesa_number=$4, tigopesa_number=$5, airtel_number=$6, payee_name=$7, support_whatsapp=$8, instructions_sw=$9, mpesa_active=$10, tigopesa_active=$11, airtel_active=$12
            WHERE id = 1 RETURNING *
        `, [annual_fee, duration_months, trial_days, mpesa_number, tigopesa_number, airtel_number, payee_name, support_whatsapp, instructions_sw, mpesa_active, tigopesa_active, airtel_active]);
        res.json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/subscriptions/my-subscription', authenticateToken, async (req, res) => {
    if (!req.user.school_id) return res.status(400).json({ error: "Hana shule." });
    try {
        const school = await pool.query('SELECT name, subscription_status, trial_start_date, trial_end_date, subscription_start_date, subscription_end_date FROM schools WHERE id = $1', [req.user.school_id]);
        const settings = await pool.query('SELECT * FROM subscription_settings WHERE id = 1');
        const payments = await pool.query('SELECT * FROM school_payments WHERE school_id = $1 ORDER BY created_at DESC', [req.user.school_id]);
        res.json({ school: school.rows[0], settings: settings.rows[0], payments: payments.rows });
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.post('/api/subscriptions/payments', authenticateToken, async (req, res) => {
    if (!req.user.school_id) return res.status(400).json({ error: "Hana shule." });
    const { amount, payment_method, transaction_reference, payment_date, proof } = req.body;
    try {
        const check = await pool.query('SELECT id FROM school_payments WHERE transaction_reference = $1', [transaction_reference]);
        if (check.rows.length > 0) return res.status(400).json({ error: "Namba hii ya malipo imeshatumika." });

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(`INSERT INTO school_payments (school_id, amount, payment_method, transaction_reference, payment_date, proof_url, status) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')`, [req.user.school_id, amount, payment_method, transaction_reference, payment_date, proof]);
            await client.query(`UPDATE schools SET subscription_status = 'UNDER_REVIEW' WHERE id = $1`, [req.user.school_id]);
            await client.query('COMMIT');
            res.json({ message: "Malipo yamewasilishwa." });
        } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/admin/subscriptions/payments', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa." });
    try {
        const result = await pool.query(`SELECT p.*, s.name as school_name FROM school_payments p JOIN schools s ON p.school_id = s.id ORDER BY p.created_at DESC`);
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.post('/api/admin/payments/:id/approve', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa." });
    const { id } = req.params;
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const payRes = await client.query('SELECT * FROM school_payments WHERE id = $1 AND status = $2', [id, 'PENDING']);
            if (payRes.rows.length === 0) throw new Error("Malipo hayapatikani.");
            const payment = payRes.rows[0];
            
            await client.query(`UPDATE school_payments SET status = 'APPROVED' WHERE id = $1`, [id]);
            const settingsRes = await client.query('SELECT duration_months FROM subscription_settings WHERE id = 1');
            const months = settingsRes.rows[0].duration_months || 12;
            
            const startDate = new Date(), endDate = new Date();
            endDate.setMonth(startDate.getMonth() + months);
            
            await client.query(`UPDATE schools SET subscription_status = 'SUBSCRIPTION_ACTIVE', subscription_start_date = $1, subscription_end_date = $2 WHERE id = $3`, [startDate, endDate, payment.school_id]);
            await client.query(`INSERT INTO subscription_audit_logs (school_id, payment_id, action, admin_name, details) VALUES ($1, $2, 'APPROVED', $3, 'Imekaguliwa')`, [payment.school_id, id, req.user.name]);
            
            await client.query('COMMIT');
            res.json({ message: "Malipo yameidhinishwa." });
        } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/admin/payments/:id/reject', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa." });
    const { id } = req.params; const { reason } = req.body;
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const payRes = await client.query('SELECT * FROM school_payments WHERE id = $1 AND status = $2', [id, 'PENDING']);
            if (payRes.rows.length === 0) throw new Error("Malipo hayapatikani.");
            const payment = payRes.rows[0];
            
            await client.query(`UPDATE school_payments SET status = 'REJECTED', rejection_reason = $1 WHERE id = $2`, [reason, id]);
            await client.query(`UPDATE schools SET subscription_status = 'PAYMENT_REJECTED' WHERE id = $1`, [payment.school_id]);
            await client.query(`INSERT INTO subscription_audit_logs (school_id, payment_id, action, admin_name, details) VALUES ($1, $2, 'REJECTED', $3, $4)`, [payment.school_id, id, req.user.name, reason]);
            
            await client.query('COMMIT');
            res.json({ message: "Malipo yamekataliwa." });
        } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// ==========================================
// SHULE
// ==========================================
app.post('/api/schools', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa." });
    const { name, registration_number, region, district, level, supervisor, second_master, academic_master, center_number, manager } = req.body;
    try {
        const check = await pool.query('SELECT id FROM schools WHERE name ILIKE $1', [name]);
        if (check.rows.length > 0) return res.status(400).json({ error: "Shule ipo." });
        
        const settings = await pool.query('SELECT trial_days FROM subscription_settings WHERE id = 1');
        const trialDays = settings.rows[0].trial_days || 14;
        const trialStart = new Date(), trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + trialDays);

        const query = `INSERT INTO schools (name, registration_number, region, district, level, supervisor, second_master, academic_master, center_number, manager, subscription_status, trial_start_date, trial_end_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'TRIAL_ACTIVE', $11, $12) RETURNING *`;
        const result = await pool.query(query, [name, registration_number, region, district, level, supervisor, second_master, academic_master, center_number, manager, trialStart, trialEnd]);
        res.status(201).json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/schools', authenticateToken, async (req, res) => {
    try { const result = await pool.query('SELECT * FROM schools ORDER BY name ASC'); res.json(result.rows); } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

// ==========================================
// DASHBOARD
// ==========================================
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        let targetSchoolId = user.role === 'super_admin' ? req.query.school_id : user.school_id;
        if (!targetSchoolId) {
            const firstSchool = await pool.query('SELECT id FROM schools LIMIT 1');
            if (firstSchool.rows.length > 0) targetSchoolId = firstSchool.rows[0].id;
            else return res.json({ schoolName: "Hakuna Shule", totalStudents: 0, totalTeachers: 0, totalClasses: 0, totalExpectedFees: 0, totalCollectedFees: 0, totalOutstandingFees: 0, overallGender: { M: 0, F: 0 }, streamGenderStats: [], examStats: {}, districtRank: "-", totalSchoolsInDistrict: 0 });
        }

        let schoolName = "Shule", districtName = null;
        const schoolResult = await pool.query(`SELECT name, district FROM schools WHERE id = $1`, [targetSchoolId]);
        if (schoolResult.rows.length > 0) { schoolName = schoolResult.rows[0].name; districtName = schoolResult.rows[0].district; }

        const [studentsRes, teachersRes, classesRes] = await Promise.all([
            pool.query(`SELECT id, gender, stream_id FROM students WHERE school_id = $1`, [targetSchoolId]),
            pool.query(`SELECT COUNT(*) FROM teachers WHERE school_id = $1`, [targetSchoolId]),
            pool.query(`SELECT id, name, fee_amount FROM streams WHERE school_id = $1`, [targetSchoolId])
        ]);

        const totalStudents = studentsRes.rows.length, totalTeachers = parseInt(teachersRes.rows[0].count), totalClasses = classesRes.rows.length;
        let totalExpectedFees = 0;
        studentsRes.rows.forEach(student => { const stream = classesRes.rows.find(s => s.id === student.stream_id); if (stream) totalExpectedFees += parseFloat(stream.fee_amount || 0); });

        const currentYear = new Date().getFullYear();
        const collectedRes = await pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM fees WHERE school_id = $1 AND EXTRACT(YEAR FROM date_paid) = $2`, [targetSchoolId, currentYear]);
        const totalCollectedFees = parseFloat(collectedRes.rows[0].total), totalOutstandingFees = totalExpectedFees - totalCollectedFees;

        let maleCount = 0, femaleCount = 0;
        studentsRes.rows.forEach(s => { if (s.gender === 'M') maleCount++; if (s.gender === 'F') femaleCount++; });

        const streamGenderStats = classesRes.rows.map(stream => {
            const streamStudents = studentsRes.rows.filter(s => s.stream_id === stream.id);
            return { stream_name: stream.name, male: streamStudents.filter(s => s.gender === 'M').length, female: streamStudents.filter(s => s.gender === 'F').length };
        });

        res.json({ schoolName, totalStudents, totalTeachers, totalClasses, totalExpectedFees, totalCollectedFees, totalOutstandingFees, overallGender: {M: maleCount, F: femaleCount}, streamGenderStats, examStats: { div1: 0, div2: 0, div3: 0, div4: 0, div0: 0, inc: 0, pass: 0, abs: 0 }, role: user.role, districtRank: "-", totalSchoolsInDistrict: 0 });
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

// ==========================================
// WANAFUNZI NA WALIMU
// ==========================================
app.get('/api/teachers', authenticateToken, async (req, res) => {
    try {
        const user = req.user; let query = `SELECT * FROM teachers`; let params = [];
        if (user.role === 'super_admin') { if (req.query.school_id) { query += ` WHERE school_id = $1`; params.push(req.query.school_id); } } 
        else { query += ` WHERE school_id = $1`; params.push(user.school_id); }
        const result = await pool.query(query + ` ORDER BY full_name ASC`, params); res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.post('/api/teachers', authenticateToken, async (req, res) => {
    const { full_name, gender, phone, designation } = req.body; const user = req.user;
    const client = await pool.connect();
    try {
        let baseUsername = (full_name.trim().toLowerCase().split(/\s+/)[0] || 'teacher').replace(/[^a-z0-9]/g, '');
        let username = baseUsername, counter = 1;
        let checkUser = await client.query('SELECT * FROM users WHERE username = $1', [username]);
        while (checkUser.rows.length > 0) { username = baseUsername + counter; counter++; checkUser = await client.query('SELECT * FROM users WHERE username = $1', [username]); }
        await client.query('BEGIN');
        const result = await client.query(`INSERT INTO teachers (full_name, gender, phone, username, school_id, designation) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [full_name, gender, phone, username, user.school_id, designation || 'Mwalimu']);
        const hashedPassword = await bcrypt.hash('password123', await bcrypt.genSalt(10));
        await client.query(`INSERT INTO users (full_name, username, password_hash, role, school_id) VALUES ($1, $2, $3, $4, $5)`, [full_name, username, hashedPassword, 'teacher', user.school_id]);
        await client.query('COMMIT'); res.status(201).json({ ...result.rows[0], username });
    } catch (error) { await client.query('ROLLBACK'); res.status(500).json({ error: "Imeshindikana." }); } finally { client.release(); }
});

app.delete('/api/teachers/:id', authenticateToken, async (req, res) => {
    const { id } = req.params; const user = req.user;
    try {
        let query = `DELETE FROM teachers WHERE id=$1`; let params = [id];
        if (user.role !== 'super_admin') { query += ` AND school_id=$2`; params.push(user.school_id); }
        await pool.query(query, params); res.json({ message: "Amefutwa" });
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/students', authenticateToken, async (req, res) => {
    try {
        const user = req.user; let query = `SELECT * FROM students`; let params = [], conditions = [];
        if (user.role === 'super_admin') { if (req.query.school_id) { conditions.push(`school_id = $${params.length + 1}`); params.push(req.query.school_id); } } 
        else { conditions.push(`school_id = $${params.length + 1}`); params.push(user.school_id); }
        if (req.query.stream_id) { conditions.push(`stream_id = $${params.length + 1}`); params.push(req.query.stream_id); }
        if (conditions.length > 0) query += ` WHERE ` + conditions.join(' AND ');
        const result = await pool.query(query + ` ORDER BY full_name ASC`, params); res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.post('/api/students', authenticateToken, async (req, res) => {
    const { full_name, gender, stream_id, admission_number } = req.body; const user = req.user;
    try {
        const result = await pool.query(`INSERT INTO students (full_name, gender, stream_id, admission_number, school_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`, [full_name, gender, stream_id, admission_number, user.school_id]);
        res.status(201).json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.delete('/api/students/:id', authenticateToken, async (req, res) => {
    const { id } = req.params; const user = req.user;
    try {
        let query = `DELETE FROM students WHERE id=$1`; let params = [id];
        if (user.role !== 'super_admin') { query += ` AND school_id=$2`; params.push(user.school_id); }
        await pool.query(query, params); res.json({ message: "Amefutwa" });
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

// ==========================================
// MIPANGILIO, ADA, ALAMA
// ==========================================
app.get('/api/streams', authenticateToken, async (req, res) => {
    const user = req.user; const result = await pool.query(`SELECT * FROM streams WHERE school_id = $1 ORDER BY name ASC`, [user.school_id || 1]); res.json(result.rows);
});
app.post('/api/streams', authenticateToken, async (req, res) => {
    const { name, fee_amount } = req.body; const user = req.user;
    try { const result = await pool.query(`INSERT INTO streams (name, fee_amount, school_id) VALUES ($1, $2, $3) RETURNING *`, [name, fee_amount || 0, user.school_id || 1]); res.status(201).json(result.rows[0]); } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});
app.get('/api/subjects', authenticateToken, async (req, res) => {
    const user = req.user; const result = await pool.query(`SELECT * FROM subjects WHERE school_id = $1 ORDER BY name ASC`, [user.school_id || 1]); res.json(result.rows);
});
app.post('/api/subjects', authenticateToken, async (req, res) => {
    const { name } = req.body; const user = req.user;
    try { const result = await pool.query(`INSERT INTO subjects (name, school_id) VALUES ($1, $2) RETURNING *`, [name, user.school_id || 1]); res.status(201).json(result.rows[0]); } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});
app.get('/api/exams', authenticateToken, async (req, res) => {
    const user = req.user; const result = await pool.query(`SELECT id, name, is_locked FROM exams WHERE school_id = $1 ORDER BY id DESC`, [user.school_id || 1]); res.json(result.rows);
});
app.post('/api/exams', authenticateToken, async (req, res) => {
    const { name } = req.body; const user = req.user;
    try { const result = await pool.query(`INSERT INTO exams (name, school_id) VALUES ($1, $2) RETURNING *`, [name, user.school_id || 1]); res.status(201).json(result.rows[0]); } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/fees/balances', authenticateToken, async (req, res) => {
    const user = req.user;
    try {
        const result = await pool.query(`SELECT s.id, s.full_name, st.name as stream_name, COALESCE(st.fee_amount, 0) as expected_fee, COALESCE(SUM(f.amount), 0) as total_paid FROM students s LEFT JOIN streams st ON s.stream_id = st.id LEFT JOIN fees f ON s.id = f.student_id WHERE s.school_id = $1 GROUP BY s.id, s.full_name, st.name, st.fee_amount`, [user.school_id || 1]);
        res.json(result.rows.map(row => ({ ...row, balance: parseFloat(row.expected_fee) - parseFloat(row.total_paid) })));
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});
app.post('/api/fees', authenticateToken, async (req, res) => {
    const { student_id, amount, date_paid } = req.body; const user = req.user;
    try { const result = await pool.query(`INSERT INTO fees (student_id, amount, date_paid, school_id) VALUES ($1, $2, $3, $4) RETURNING *`, [student_id, amount, date_paid, user.school_id || 1]); res.status(201).json(result.rows[0]); } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/results/existing', authenticateToken, async (req, res) => {
    const { exam_id, subject_id, stream_id } = req.query; const user = req.user;
    try { const result = await pool.query(`SELECT r.student_id, r.score FROM results r JOIN students s ON r.student_id = s.id WHERE r.exam_id = $1 AND r.subject_id = $2 AND s.stream_id = $3 AND r.school_id = $4`, [exam_id, subject_id, stream_id, user.school_id || 1]); res.json(result.rows); } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});
app.post('/api/results', authenticateToken, async (req, res) => {
    const { exam_id, subject_id, marks } = req.body; const user = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM results WHERE exam_id = $1 AND subject_id = $2 AND school_id = $3', [exam_id, subject_id, user.school_id || 1]);
        for (let record of marks) { if (record.score !== '' && record.score !== null) { await client.query('INSERT INTO results (student_id, exam_id, subject_id, score, school_id) VALUES ($1, $2, $3, $4, $5)', [record.student_id, exam_id, subject_id, record.score, user.school_id || 1]); } }
        await client.query('COMMIT'); res.json({ message: "Yamehifadhiwa" });
    } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: "Imeshindikana." }); } finally { client.release(); }
});

app.use('/api', (req, res) => { res.status(404).json({ error: "API haipo" }); });
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));