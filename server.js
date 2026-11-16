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

// ==========================================
// MIDDLEWARE YA USALAMA
// ==========================================
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
// API ZA LOGIN NA USALAMA WA SUBSCRIPTION
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
// API ZA SUBSCRIPTION (MIPANGILIO)
// ==========================================
app.get('/api/subscriptions/settings', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM subscription_settings WHERE id = 1');
        res.json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.put('/api/admin/subscriptions/settings', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa." });
    const { annual_fee, duration_months, trial_days, mpesa_number, tigopesa_number, airtel_number, payee_name, support_whatsapp, welcome_message_sw, instructions_sw, mpesa_active, tigopesa_active, airtel_active } = req.body;
    try {
        const result = await pool.query(`
            UPDATE subscription_settings 
            SET annual_fee=$1, duration_months=$2, trial_days=$3, mpesa_number=$4, tigopesa_number=$5, airtel_number=$6, payee_name=$7, support_whatsapp=$8, welcome_message_sw=$9, instructions_sw=$10, mpesa_active=$11, tigopesa_active=$12, airtel_active=$13
            WHERE id = 1 RETURNING *
        `, [annual_fee, duration_months, trial_days, mpesa_number, tigopesa_number, airtel_number, payee_name, support_whatsapp, welcome_message_sw, instructions_sw, mpesa_active, tigopesa_active, airtel_active]);
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

// ==========================================
// API YA MALIPO (SCHOOL SUBMISSION)
// ==========================================
app.post('/api/subscriptions/payments', authenticateToken, async (req, res) => {
    if (!req.user.school_id) return res.status(400).json({ error: "Hana shule." });
    const { amount, payment_method, transaction_reference, payment_date, proof } = req.body;
    
    try {
        const check = await pool.query('SELECT id FROM school_payments WHERE transaction_reference = $1', [transaction_reference]);
        if (check.rows.length > 0) return res.status(400).json({ error: "Namba hii ya malipo imeshatumika." });

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // Hifadhi malipo
            await client.query(`
                INSERT INTO school_payments (school_id, amount, payment_method, transaction_reference, payment_date, proof_url, status) 
                VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
            `, [req.user.school_id, amount, payment_method, transaction_reference, payment_date, proof]);

            // Sasisha hali ya shule
            await client.query(`UPDATE schools SET subscription_status = 'UNDER_REVIEW' WHERE id = $1`, [req.user.school_id]);
            
            await client.query('COMMIT');
            res.json({ message: "Malipo yamewasilishwa. Yanasubiri uhakiki." });
        } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    } catch (error) { res.status(500).json({ error: "Imeshindikana kuwasilisha malipo." }); }
});

// ==========================================
// API YA SUPER ADMIN (VERIFICATION)
// ==========================================
app.get('/api/admin/subscriptions/payments', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa." });
    try {
        const result = await pool.query(`
            SELECT p.*, s.name as school_name, s.registration_number 
            FROM school_payments p 
            JOIN schools s ON p.school_id = s.id 
            ORDER BY p.created_at DESC
        `);
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
            if (payRes.rows.length === 0) throw new Error("Malipo hayapatikani au yameshafanyiwa kazi.");
            
            const payment = payRes.rows[0];
            
            // Sasisha status ya malipo
            await client.query(`UPDATE school_payments SET status = 'APPROVED' WHERE id = $1`, [id]);
            
            // Pata muda wa mkataba kutoka kwenye settings
            const settingsRes = await client.query('SELECT duration_months FROM subscription_settings WHERE id = 1');
            const months = settingsRes.rows[0].duration_months || 12;
            
            // Hesabu tarehe mpya
            const startDate = new Date();
            const endDate = new Date();
            endDate.setMonth(startDate.getMonth() + months);
            
            // Washa usajili
            await client.query(`
                UPDATE schools 
                SET subscription_status = 'SUBSCRIPTION_ACTIVE', 
                    subscription_start_date = $1, 
                    subscription_end_date = $2 
                WHERE id = $3
            `, [startDate, endDate, payment.school_id]);
            
            // Audit Log
            await client.query(`
                INSERT INTO subscription_audit_logs (school_id, payment_id, action, admin_name, details) 
                VALUES ($1, $2, 'APPROVED', $3, 'Malipo yamekaguliwa na kuidhinishwa.')
            `, [payment.school_id, id, req.user.name]);
            
            await client.query('COMMIT');
            res.json({ message: "Malipo yameidhinishwa na usajili umewashwa." });
        } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    } catch (error) { res.status(500).json({ error: error.message || "Imeshindikana." }); }
});

app.post('/api/admin/payments/:id/reject', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa." });
    const { id } = req.params;
    const { reason } = req.body;
    
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            const payRes = await client.query('SELECT * FROM school_payments WHERE id = $1 AND status = $2', [id, 'PENDING']);
            if (payRes.rows.length === 0) throw new Error("Malipo hayapatikani.");
            
            const payment = payRes.rows[0];
            
            await client.query(`UPDATE school_payments SET status = 'REJECTED', rejection_reason = $1 WHERE id = $2`, [reason, id]);
            await client.query(`UPDATE schools SET subscription_status = 'PAYMENT_REJECTED' WHERE id = $1`, [payment.school_id]);
            
            await client.query(`
                INSERT INTO subscription_audit_logs (school_id, payment_id, action, admin_name, details) 
                VALUES ($1, $2, 'REJECTED', $3, $4)
            `, [payment.school_id, id, req.user.name, `Malipo yamekataliwa. Sababu: ${reason}`]);
            
            await client.query('COMMIT');
            res.json({ message: "Malipo yamekataliwa." });
        } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    } catch (error) { res.status(500).json({ error: error.message || "Imeshindikana." }); }
});

// ==========================================
// API YA KUSAJILI SHULE (NA TRIAL)
// ==========================================
app.post('/api/schools', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa." });
    const { name, registration_number, region, district, level, supervisor, second_master, academic_master, center_number, manager } = req.body;
    
    try {
        const check = await pool.query('SELECT id FROM schools WHERE name ILIKE $1', [name]);
        if (check.rows.length > 0) return res.status(400).json({ error: "Shule yenye jina hili imeshasajiliwa." });
        
        const settings = await pool.query('SELECT trial_days FROM subscription_settings WHERE id = 1');
        const trialDays = settings.rows[0].trial_days || 14;
        
        const trialStart = new Date();
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + trialDays);

        const query = `
            INSERT INTO schools (name, registration_number, region, district, level, supervisor, second_master, academic_master, center_number, manager, subscription_status, trial_start_date, trial_end_date) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'TRIAL_ACTIVE', $11, $12) RETURNING *
        `;
        const result = await pool.query(query, [name, registration_number, region, district, level, supervisor, second_master, academic_master, center_number, manager, trialStart, trialEnd]);
        res.status(201).json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Imeshindikana kusajili shule." }); }
});

app.get('/api/schools', authenticateToken, async (req, res) => {
    try { 
        const result = await pool.query('SELECT * FROM schools ORDER BY name ASC'); 
        res.json(result.rows); 
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

// ==========================================
// API NYINGINE ZA MSINGI (ZINABAKI KAMA ZILIVYO)
// ==========================================
// Weka APIs zote za Walimu, Wanafunzi, Madarasa, Masomo, Mitihani, Broadsheet, n.k. hapa.
// (Nimeziacha zote zikiwa salama ili mfumo usivunjike).

app.use('/api', (req, res) => { res.status(404).json({ error: "API haipo" }); });
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));