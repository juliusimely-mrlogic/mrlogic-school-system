const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const bcrypt = require('bcryptjs'); 
const multer = require('multer');
const xlsx = require('xlsx');
const crypto = require('crypto');
const pool = require('./db'); 

const app = express();
app.use(cors());
// Webhook inahitaji raw body, siyo JSON iliyoparsed
app.use('/api/webhooks/snippe', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ==========================================
// HELPER FUNCTIONS
// ==========================================
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
// ANNOUNCEMENTS & AUTH
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
// SUBSCRIPTION & PAYMENT GATEWAY
// ==========================================
app.get('/api/subscriptions/settings', authenticateToken, async (req, res) => {
    try { 
        const result = await pool.query('SELECT id, annual_fee, duration_months, trial_days, support_whatsapp, instructions_sw, gateway_provider FROM subscription_settings WHERE id = 1'); 
        res.json(result.rows[0]); 
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.put('/api/admin/subscriptions/settings', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa." });
    const { annual_fee, duration_months, trial_days, support_whatsapp, instructions_sw, gateway_provider, gateway_api_key, gateway_webhook_secret } = req.body;
    try {
        const result = await pool.query(`
            UPDATE subscription_settings 
            SET annual_fee=$1, duration_months=$2, trial_days=$3, support_whatsapp=$4, instructions_sw=$5, gateway_provider=$6, gateway_api_key=$7, gateway_webhook_secret=$8
            WHERE id = 1 RETURNING *
        `, [annual_fee, duration_months, trial_days, support_whatsapp, instructions_sw, gateway_provider, gateway_api_key, gateway_webhook_secret]);
        res.json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/subscriptions/my-subscription', authenticateToken, async (req, res) => {
    if (!req.user.school_id) return res.status(400).json({ error: "Hana shule." });
    try {
        const school = await pool.query('SELECT name, subscription_status, trial_start_date, trial_end_date, subscription_start_date, subscription_end_date FROM schools WHERE id = $1', [req.user.school_id]);
        const settings = await pool.query('SELECT * FROM subscription_settings WHERE id = 1');
        const payments = await pool.query('SELECT * FROM payment_transactions WHERE school_id = $1 ORDER BY created_at DESC', [req.user.school_id]);
        res.json({ school: school.rows[0], settings: settings.rows[0], payments: payments.rows });
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

// API YA KUANZISHA MALIPO (PAYMENT INITIATION)
app.post('/api/subscriptions/payments', authenticateToken, async (req, res) => {
    if (!req.user.school_id) return res.status(400).json({ error: "Hana shule." });
    const { phone_number } = req.body; 
    
    try {
        const settings = await pool.query('SELECT * FROM subscription_settings WHERE id = 1');
        const amount = settings.rows[0].annual_fee;
        const internalRef = 'SCH-' + req.user.school_id + '-' + Date.now();

        await pool.query(`
            INSERT INTO payment_transactions (school_id, internal_reference, amount, status, phone_number) 
            VALUES ($1, $2, $3, 'INITIATED', $4)
        `, [req.user.school_id, internalRef, amount, phone_number]);

        // MUHIMU: Hapa unatuma ombi kwa Payment Gateway yako (Mfano Snippe)
        // Kwa mfano huu, tunadhani gateway imepokea ombi na kurejesha provider_reference
        const providerRef = 'PRV-' + Math.floor(Math.random() * 1000000); 
        
        await pool.query(`
            UPDATE payment_transactions SET status = 'PENDING', provider_reference = $1 WHERE internal_reference = $2
        `, [providerRef, internalRef]);

        res.json({ message: "Malipo yameanzishwa. Thibitisha kwenye simu yako.", reference: internalRef });
    } catch (error) { 
        console.error(error);
        res.status(500).json({ error: "Imeshindikana kuanzisha malipo." }); 
    }
});

// WEBHOOK YA MALIPO (AUTOMATIC VERIFICATION)
app.post('/api/webhooks/snippe', async (req, res) => {
    try {
        const settings = await pool.query('SELECT gateway_webhook_secret FROM subscription_settings WHERE id = 1');
        const secret = settings.rows[0].gateway_webhook_secret;
        
        if (secret) {
            const signature = req.headers['x-webhook-signature'];
            const expectedSignature = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
            if (signature !== expectedSignature) return res.status(401).json({ error: "Invalid signature" });
        }

        const event = JSON.parse(req.body.toString());
        
        const checkEvent = await pool.query('SELECT id FROM payment_webhook_events WHERE event_id = $1', [event.id]);
        if (checkEvent.rows.length > 0) return res.status(200).json({ message: "Event already processed." });
        await pool.query('INSERT INTO payment_webhook_events (event_id, provider, payload) VALUES ($1, $2, $3)', [event.id, 'snippe', JSON.stringify(event)]);

        if (event.type === 'payment.completed' && event.data.status === 'success') {
            const providerRef = event.data.reference;
            const amountPaid = event.data.amount;

            const txResult = await pool.query('SELECT * FROM payment_transactions WHERE provider_reference = $1 AND status = $2', [providerRef, 'PENDING']);
            
            if (txResult.rows.length > 0) {
                const tx = txResult.rows[0];
                if (parseFloat(amountPaid) !== parseFloat(tx.amount)) {
                    await pool.query('UPDATE payment_transactions SET status = $1 WHERE id = $2', ['REVIEW_REQUIRED', tx.id]);
                    return res.status(200).json({ message: "Amount mismatch. Flagged for review." });
                }

                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    await client.query('UPDATE payment_transactions SET status = $1, updated_at = NOW() WHERE id = $2', ['SUCCESS', tx.id]);
                    const schoolResult = await client.query('SELECT subscription_status, subscription_end_date FROM schools WHERE id = $1', [tx.school_id]);
                    const school = schoolResult.rows[0];

                    let newStartDate = new Date();
                    let newEndDate = new Date();
                    newEndDate.setFullYear(newStartDate.getFullYear() + 1); 

                    if (school.subscription_status === 'SUBSCRIPTION_ACTIVE' && school.subscription_end_date) {
                        newStartDate = new Date(school.subscription_end_date);
                        newEndDate = new Date(newStartDate);
                        newEndDate.setFullYear(newEndDate.getFullYear() + 1);
                    }

                    await client.query(`
                        UPDATE schools 
                        SET subscription_status = 'SUBSCRIPTION_ACTIVE', subscription_start_date = $1, subscription_end_date = $2
                        WHERE id = $3
                    `, [newStartDate, newEndDate, tx.school_id]);
                    await client.query('COMMIT');
                } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
            }
        }
        res.status(200).json({ message: "Webhook processed." });
    } catch (error) { res.status(500).json({ error: "Internal server error." }); }
});

// ==========================================
// SHULE, DASHBOARD NA WANAFUNZI
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

// (Weka APIs zilizobaki za Walimu, Wanafunzi, Madarasa, n.k. kama zilivyokuwa)
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

app.use('/api', (req, res) => { res.status(404).json({ error: "API haipo" }); });
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));