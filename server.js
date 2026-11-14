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

// ==========================================
// KAZI YA KUTUMA SMS (BEEM AFRICA)
// ==========================================
const sendSMS = async (phoneNumber, message) => {
    const apiKey = process.env.BEEM_API_KEY;
    const secretKey = process.env.BEEM_SECRET_KEY;
    const senderId = process.env.BEEM_SENDER_ID || 'INFO'; // Jina la mtumaji (Sender ID)

    // Kama API Keys hazipo, tunaandika kwenye console (Simulation)
    if (!apiKey || !secretKey) {
        console.log("⚠️ [SMS SIMULATION] Beem API Keys hazijawekwa. Ujumbe ambao ungetumwa kwa " + phoneNumber + " ni: " + message);
        return;
    }

    // Safisha namba ya simu (mfano 0712345678 -> 255712345678)
    let formattedPhone = phoneNumber.replace(/\D/g, ''); // Ondoa vitu kama +, - au nafasi
    if (formattedPhone.startsWith('0')) {
        formattedPhone = '255' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('+')) {
        formattedPhone = formattedPhone.substring(1);
    }

    try {
        const auth = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');
        
        const response = await fetch('https://apisms.beem.africa/v1/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`
            },
            body: JSON.stringify({
                source_addr: senderId,
                schedule_time: "",
                encoding: 0,
                message: message,
                recipients: [{ recipient_id: "1", dest_addr: formattedPhone }]
            })
        });

        const data = await response.json();
        console.log("Beem SMS Response:", data);
    } catch (error) {
        console.error("Kosa la kutuma SMS kupitia Beem:", error);
    }
};

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

// 3. API YA TAARIFA (NOTIFICATIONS)
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
    const finalSchoolId = user.school_id || null;

    try {
        const query = `INSERT INTO notifications (title, message, sender_name, target_role, school_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`;
        const result = await pool.query(query, [title, message, user.name, target_role || 'all', finalSchoolId]);
        res.status(201).json(result.rows[0]);
    } catch (error) { 
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

// 4. API YA WANAFUNZI (CRUD + BULK)
app.get('/api/students', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        let query = `SELECT id, full_name, gender, stream_id, admission_number, parent_phone FROM students`;
        let params = [], conditions = [];
        if (user.role === 'super_admin') { if (req.query.school_id) { conditions.push(`school_id = $${params.length + 1}`); params.push(req.query.school_id); } } 
        else { if (!user.school_id) return res.status(400).json({ error: "Mtumiaji hana shule" }); conditions.push(`school_id = $${params.length + 1}`); params.push(user.school_id); }
        if (req.query.stream_id) { conditions.push(`stream_id = $${params.length + 1}`); params.push(req.query.stream_id); }
        if (conditions.length > 0) { query += ` WHERE ` + conditions.join(' AND '); }
        query += ` ORDER BY full_name ASC`;
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana kuleta wanafunzi" }); }
});

app.post('/api/students', authenticateToken, async (req, res) => {
    const { full_name, gender, stream_id, admission_number, parent_phone } = req.body; const user = req.user;
    if (!user.school_id) return res.status(400).json({ error: "Mtumiaji hana shule" });
    try {
        const query = `INSERT INTO students (full_name, gender, stream_id, admission_number, parent_phone, school_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
        const result = await pool.query(query, [full_name, gender, stream_id, admission_number, parent_phone, user.school_id]);
        res.status(201).json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Imeshindikana kusajili." }); }
});

app.post('/api/students/bulk', authenticateToken, upload.single('file'), async (req, res) => {
    const user = req.user; if (!user.school_id) return res.status(400).json({ error: "Mtumiaji hana shule" });
    if (!req.file) return res.status(400).json({ error: "Tafadhali pakia faili la Excel." });
    try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        if (data.length === 0) return res.status(400).json({ error: "Faili ni tupu." });
        let insertedCount = 0; let failedCount = 0; let errors = [];
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (let row of data) {
                const full_name = row['Jina Kamili'] || row['full_name'];
                const admission_number = row['Namba ya Usajili'] || row['admission_number'];
                const gender = row['Jinsia'] || row['gender'];
                const stream_id = row['Darasa ID'] || row['stream_id'];
                const parent_phone = row['Namba ya Mzazi'] || row['parent_phone'];
                if (!full_name || !admission_number) { failedCount++; errors.push(`Mwanafunzi ${full_name || 'asiyejulikana'} hana jina/namba.`); continue; }
                try {
                    await client.query(`INSERT INTO students (full_name, gender, stream_id, admission_number, parent_phone, school_id) VALUES ($1, $2, $3, $4, $5, $6)`, [full_name, gender || 'M', stream_id || null, admission_number, parent_phone || null, user.school_id]);
                    insertedCount++;
                } catch (dbErr) { failedCount++; errors.push(`Mwanafunzi ${full_name} (${admission_number}) ameshindikana.`); }
            }
            await client.query('COMMIT');
        } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
        res.status(200).json({ message: `Imekamilika. Waliowekwa: ${insertedCount}. Waliokosa: ${failedCount}.`, errors });
    } catch (error) { res.status(500).json({ error: "Imeshindikana kusoma faili." }); }
});

app.put('/api/students/:id', authenticateToken, async (req, res) => {
    const { id } = req.params; const { full_name, gender, stream_id, admission_number, parent_phone } = req.body; const user = req.user;
    try {
        let query = `UPDATE students SET full_name=$1, gender=$2, stream_id=$3, admission_number=$4, parent_phone=$5 WHERE id=$6`; let params = [full_name, gender, stream_id, admission_number, parent_phone, id];
        if (user.role !== 'super_admin') { query += ` AND school_id=$7`; params.push(user.school_id); }
        query += ` RETURNING *`; const result = await pool.query(query, params);
        if (result.rowCount === 0) return res.status(404).json({ error: "Hajapatikana" });
        res.json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Imeshindikana kuboresha." }); }
});

app.delete('/api/students/:id', authenticateToken, async (req, res) => {
    const { id } = req.params; const user = req.user;
    try {
        let query = `DELETE FROM students WHERE id=$1`; let params = [id];
        if (user.role !== 'super_admin') { query += ` AND school_id=$2`; params.push(user.school_id); }
        const result = await pool.query(query, params);
        if (result.rowCount === 0) return res.status(404).json({ error: "Hajapatikana" });
        res.json({ message: "Amefutwa" });
    } catch (error) { res.status(500).json({ error: "Imeshindikana kufuta." }); }
});

// 5. API YA WALIMU
app.get('/api/teachers', authenticateToken, async (req, res) => {
    try {
        const user = req.user; let query = `SELECT * FROM teachers`; let params = [];
        if (user.role === 'super_admin') { if (req.query.school_id) { query += ` WHERE school_id = $1`; params.push(req.query.school_id); } } 
        else { if (!user.school_id) return res.status(400).json({ error: "Hana shule" }); query += ` WHERE school_id = $1`; params.push(user.school_id); }
        query += ` ORDER BY full_name ASC`; const result = await pool.query(query, params); res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.post('/api/teachers', authenticateToken, async (req, res) => {
    const { full_name, gender, phone, email } = req.body; const user = req.user;
    if (!user.school_id) return res.status(400).json({ error: "Hana shule" });
    try {
        const query = `INSERT INTO teachers (full_name, gender, phone, email, school_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`;
        const result = await pool.query(query, [full_name, gender, phone, email, user.school_id]);
        res.status(201).json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.put('/api/teachers/:id', authenticateToken, async (req, res) => {
    const { id } = req.params; const { full_name, gender, phone, email } = req.body; const user = req.user;
    try {
        let query = `UPDATE teachers SET full_name=$1, gender=$2, phone=$3, email=$4 WHERE id=$5`; let params = [full_name, gender, phone, email, id];
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

// 6. API YA MAHUDHURIO
app.post('/api/attendance', authenticateToken, async (req, res) => {
    const { records, date } = req.body; const user = req.user;
    if (!user.school_id) return res.status(400).json({ error: "Hana shule" });
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM attendance WHERE date = $1 AND school_id = $2', [date, user.school_id]);
            for (let record of records) { await client.query('INSERT INTO attendance (student_id, date, status, school_id) VALUES ($1, $2, $3, $4)', [record.student_id, date, record.status, user.school_id]); }
            await client.query('COMMIT'); res.json({ message: "Yamehifadhiwa" });
        } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

// 7. API YA MADARASA
app.get('/api/streams', authenticateToken, async (req, res) => {
    try {
        const user = req.user; let query = `SELECT * FROM streams`; let params = [];
        if (user.role === 'super_admin') { if (req.query.school_id) { query += ` WHERE school_id = $1`; params.push(req.query.school_id); } } 
        else { if (!user.school_id) return res.status(400).json({ error: "Hana shule" }); query += ` WHERE school_id = $1`; params.push(user.school_id); }
        query += ` ORDER BY name ASC`; const result = await pool.query(query, params); res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.post('/api/streams', authenticateToken, async (req, res) => {
    const { name, fee_amount } = req.body; const user = req.user;
    if (!user.school_id) return res.status(400).json({ error: "Hana shule" });
    try {
        const query = `INSERT INTO streams (name, fee_amount, school_id) VALUES ($1, $2, $3) RETURNING *`;
        const result = await pool.query(query, [name, fee_amount || 0, user.school_id]);
        res.status(201).json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

// 8. API YA MALIPO (HAPA NDIPO TUNAITA SMS)
app.get('/api/fees', authenticateToken, async (req, res) => {
    try {
        const user = req.user; let query = `SELECT f.*, s.full_name as student_name FROM fees f LEFT JOIN students s ON f.student_id = s.id`; let params = [];
        if (user.role === 'super_admin') { if (req.query.school_id) { query += ` WHERE f.school_id = $1`; params.push(req.query.school_id); } } 
        else { if (!user.school_id) return res.status(400).json({ error: "Hana shule" }); query += ` WHERE f.school_id = $1`; params.push(user.school_id); }
        query += ` ORDER BY f.id DESC`; const result = await pool.query(query, params); res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.post('/api/fees', authenticateToken, async (req, res) => {
    const { student_id, amount, date_paid } = req.body; const user = req.user;
    if (!user.school_id) return res.status(400).json({ error: "Hana shule" });
    try {
        const query = `INSERT INTO fees (student_id, amount, date_paid, school_id) VALUES ($1, $2, $3, $4) RETURNING *`;
        const result = await pool.query(query, [student_id, amount, date_paid, user.school_id]);

        // === SMS INTEGRATION HAPA ===
        // 1. Chukua taarifa za mwanafunzi (jina na namba ya mzazi)
        const studentRes = await pool.query('SELECT full_name, parent_phone FROM students WHERE id = $1', [student_id]);
        if (studentRes.rows.length > 0 && studentRes.rows[0].parent_phone) {
            const student = studentRes.rows[0];
            const formattedAmount = parseFloat(amount).toLocaleString();
            const smsMessage = `Ndugu mzazi, tumepokea malipo ya Tsh ${formattedAmount} kwa ajili ya ${student.full_name}. Asante kwa kushirikiana nasi.`;
            
            // 2. Tuma SMS (Haitazuia mfumo kukamilisha malipo kama SMS ikifeli)
            sendSMS(student.parent_phone, smsMessage);
        }
        // ===========================

        res.status(201).json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Imeshindikana kurekodi malipo." }); }
});

app.get('/api/fees/balances', authenticateToken, async (req, res) => {
    const user = req.user; if (!user.school_id) return res.status(400).json({ error: "Hana shule" });
    try {
        const query = `SELECT s.id, s.full_name, s.admission_number, st.name as stream_name, COALESCE(st.fee_amount, 0) as expected_fee, COALESCE(SUM(f.amount), 0) as total_paid FROM students s LEFT JOIN streams st ON s.stream_id = st.id LEFT JOIN fees f ON s.id = f.student_id WHERE s.school_id = $1 GROUP BY s.id, s.full_name, s.admission_number, st.name, st.fee_amount ORDER BY s.full_name ASC`;
        const result = await pool.query(query, [user.school_id]);
        const balances = result.rows.map(row => ({ ...row, balance: parseFloat(row.expected_fee) - parseFloat(row.total_paid) }));
        res.json(balances);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

// 9. API YA MASOMO
app.get('/api/subjects', authenticateToken, async (req, res) => {
    try {
        const user = req.user; let query = `SELECT * FROM subjects`; let params = [];
        if (user.role === 'super_admin') { if (req.query.school_id) { query += ` WHERE school_id = $1`; params.push(req.query.school_id); } } 
        else { if (!user.school_id) return res.status(400).json({ error: "Hana shule" }); query += ` WHERE school_id = $1`; params.push(user.school_id); }
        query += ` ORDER BY name ASC`; const result = await pool.query(query, params); res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.post('/api/subjects', authenticateToken, async (req, res) => {
    const { name } = req.body; const user = req.user;
    if (!user.school_id) return res.status(400).json({ error: "Hana shule" });
    try {
        const query = `INSERT INTO subjects (name, school_id) VALUES ($1, $2) RETURNING *`;
        const result = await pool.query(query, [name, user.school_id]);
        res.status(201).json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

// 10. API YA MITIHANI
app.get('/api/exams', authenticateToken, async (req, res) => {
    try {
        const user = req.user; let query = `SELECT * FROM exams`; let params = [];
        if (user.role === 'super_admin') { if (req.query.school_id) { query += ` WHERE school_id = $1`; params.push(req.query.school_id); } } 
        else { if (!user.school_id) return res.status(400).json({ error: "Hana shule" }); query += ` WHERE school_id = $1`; params.push(user.school_id); }
        query += ` ORDER BY id DESC`; const result = await pool.query(query, params); res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.post('/api/exams', authenticateToken, async (req, res) => {
    const { name } = req.body; const user = req.user;
    if (!user.school_id) return res.status(400).json({ error: "Hana shule" });
    try {
        const query = `INSERT INTO exams (name, school_id) VALUES ($1, $2) RETURNING *`;
        const result = await pool.query(query, [name, user.school_id]);
        res.status(201).json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

// 11. KUHIFADHI ALAMA
app.post('/api/results', authenticateToken, async (req, res) => {
    const { exam_id, subject_id, marks } = req.body; const user = req.user;
    if (!user.school_id) return res.status(400).json({ error: "Hana shule" });
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM results WHERE exam_id = $1 AND subject_id = $2 AND school_id = $3', [exam_id, subject_id, user.school_id]);
            for (let record of marks) { if (record.score !== '' && record.score !== null) { await client.query('INSERT INTO results (student_id, exam_id, subject_id, score, school_id) VALUES ($1, $2, $3, $4, $5)', [record.student_id, exam_id, subject_id, record.score, user.school_id]); } }
            await client.query('COMMIT'); res.json({ message: "Yamehifadhiwa" });
        } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

// 12. RIPOTI (BROADSHEET NA MWANAFUNZI)
app.get('/api/reports/broadsheet', authenticateToken, async (req, res) => {
    const { exam_id, stream_id } = req.query; const user = req.user;
    if (!exam_id || !stream_id) return res.status(400).json({ error: "Chagua" });
    if (!user.school_id) return res.status(400).json({ error: "Hana shule" });
    try {
        const studentsRes = await pool.query(`SELECT id, full_name FROM students WHERE stream_id = $1 AND school_id = $2 ORDER BY full_name ASC`, [stream_id, user.school_id]);
        const subjectsRes = await pool.query(`SELECT id, name FROM subjects WHERE school_id = $1 ORDER BY id ASC`, [user.school_id]);
        const resultsRes = await pool.query(`SELECT r.student_id, r.subject_id, r.score FROM results r JOIN students s ON r.student_id = s.id WHERE r.exam_id = $1 AND s.stream_id = $2 AND r.school_id = $3`, [exam_id, stream_id, user.school_id]);
        const reportData = studentsRes.rows.map(student => {
            let totalScore = 0, subjectsCount = 0; const scores = {};
            subjectsRes.rows.forEach(sub => {
                const result = resultsRes.rows.find(r => r.student_id === student.id && r.subject_id === sub.id);
                if (result) { scores[sub.id] = parseFloat(result.score); totalScore += parseFloat(result.score); subjectsCount++; } else { scores[sub.id] = '-'; }
            });
            return { student_id: student.id, full_name: student.full_name, scores, total: totalScore, average: subjectsCount > 0 ? parseFloat((totalScore / subjectsCount).toFixed(2)) : 0 };
        });
        reportData.sort((a, b) => b.total - a.total);
        let currentPosition = 1;
        for (let i = 0; i < reportData.length; i++) { if (i > 0 && reportData[i].total < reportData[i-1].total) { currentPosition = i + 1; } reportData[i].position = currentPosition; }
        res.json({ subjects: subjectsRes.rows, reportData });
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/reports/student/:student_id', authenticateToken, async (req, res) => {
    const { student_id } = req.params; const { exam_id } = req.query; const user = req.user;
    if (!exam_id) return res.status(400).json({ error: "Chagua" });
    if (!user.school_id) return res.status(400).json({ error: "Hana shule" });
    try {
        const studentRes = await pool.query(`SELECT id, full_name, admission_number, stream_id FROM students WHERE id = $1 AND school_id = $2`, [student_id, user.school_id]);
        if (studentRes.rows.length === 0) return res.status(404).json({ error: "Hajapatikana" });
        const student = studentRes.rows[0];
        const streamRes = await pool.query(`SELECT name FROM streams WHERE id = $1`, [student.stream_id]);
        const streamName = streamRes.rows.length > 0 ? streamRes.rows[0].name : '-';
        const subjectsRes = await pool.query(`SELECT id, name FROM subjects WHERE school_id = $1 ORDER BY id ASC`, [user.school_id]);
        const resultsRes = await pool.query(`SELECT subject_id, score FROM results WHERE student_id = $1 AND exam_id = $2 AND school_id = $3`, [student_id, exam_id, user.school_id]);
        let totalScore = 0, subjectsCount = 0;
        const scores = subjectsRes.rows.map(sub => {
            const result = resultsRes.rows.find(r => r.subject_id === sub.id);
            let score = '-', grade = '-';
            if (result) { score = parseFloat(result.score); totalScore += score; subjectsCount++; if (score >= 75) grade = 'A'; else if (score >= 65) grade = 'B'; else if (score >= 45) grade = 'C'; else if (score >= 30) grade = 'D'; else grade = 'F'; }
            return { name: sub.name, score: score, grade: grade };
        });
        const average = subjectsCount > 0 ? (totalScore / subjectsCount).toFixed(2) : 0;
        const classResultsRes = await pool.query(`SELECT r.student_id, SUM(r.score) as total FROM results r JOIN students s ON r.student_id = s.id WHERE s.stream_id = $1 AND r.exam_id = $2 AND r.school_id = $3 GROUP BY r.student_id ORDER BY total DESC`, [student.stream_id, exam_id, user.school_id]);
        let position = '-', totalInClass = classResultsRes.rows.length;
        if (totalInClass > 0) { const rank = classResultsRes.rows.findIndex(r => r.student_id == student_id); position = rank !== -1 ? rank + 1 : '-'; }
        const schoolRes = await pool.query(`SELECT name FROM schools WHERE id = $1`, [user.school_id]);
        const schoolName = schoolRes.rows.length > 0 ? schoolRes.rows[0].name : 'Shule';
        res.json({ schoolName, student, streamName, scores, total: totalScore, average: parseFloat(average), position, totalInClass });
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

// 13. API YA SHULE NA WATUMIAJI
app.get('/api/schools', authenticateToken, async (req, res) => {
    try { const result = await pool.query('SELECT * FROM schools ORDER BY name ASC'); res.json(result.rows); } 
    catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.post('/api/schools', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa" });
    const { name, code, region, district } = req.body;
    try {
        const checkName = await pool.query('SELECT id FROM schools WHERE name ILIKE $1', [name]);
        if (checkName.rows.length > 0) return res.status(400).json({ error: "Jina limeshasajiliwa" });
        const checkCode = await pool.query('SELECT id FROM schools WHERE code ILIKE $1', [code]);
        if (checkCode.rows.length > 0) return res.status(400).json({ error: "Code imeshasajiliwa" });
        const query = `INSERT INTO schools (name, code, region, district) VALUES ($1, $2, $3, $4) RETURNING *`;
        const result = await pool.query(query, [name, code, region, district]);
        res.status(201).json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.delete('/api/schools/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa" });
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM schools WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Haijapatikana" });
        res.json({ message: "Imefutwa" });
    } catch (error) { res.status(500).json({ error: "Imeshindikana. Kuna data inategemea shule hii." }); }
});

app.get('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa" });
    try { const result = await pool.query(`SELECT u.id, u.full_name, u.username, u.role, u.school_id, s.name as school_name FROM users u LEFT JOIN schools s ON u.school_id = s.id ORDER BY u.id DESC`); res.json(result.rows); } 
    catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.post('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa" });
    const { full_name, username, password, role, school_id } = req.body;
    try {
        const checkUser = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (checkUser.rows.length > 0) return res.status(400).json({ error: "Username imetumika" });
        const salt = await bcrypt.genSalt(10); const hashedPassword = await bcrypt.hash(password, salt);
        const finalSchoolId = role === 'super_admin' ? null : school_id;
        const query = `INSERT INTO users (full_name, username, password_hash, role, school_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, username, role`;
        const result = await pool.query(query, [full_name, username, hashedPassword, role, finalSchoolId]);
        res.status(201).json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: `Imeshindikana: ${error.message}` }); }
});

app.get('/api/assignments', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        let query = `SELECT ta.id, ta.teacher_id, t.full_name as teacher_name, ta.stream_id, st.name as stream_name, ta.subject_id, sub.name as subject_name FROM teacher_assignments ta JOIN teachers t ON ta.teacher_id = t.id JOIN streams st ON ta.stream_id = st.id JOIN subjects sub ON ta.subject_id = sub.id`;
        let params = [];
        if (user.role !== 'super_admin') { if (!user.school_id) return res.status(400).json({ error: "Hana shule" }); query += ` WHERE ta.school_id = $1`; params.push(user.school_id); } 
        else if (req.query.school_id) { query += ` WHERE ta.school_id = $1`; params.push(req.query.school_id); }
        query += ` ORDER BY t.full_name ASC`; const result = await pool.query(query, params); res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.post('/api/assignments', authenticateToken, async (req, res) => {
    const { teacher_id, stream_id, subject_id } = req.body; const user = req.user;
    if (!user.school_id) return res.status(400).json({ error: "Hana shule" });
    try {
        const check = await pool.query('SELECT * FROM teacher_assignments WHERE teacher_id = $1 AND stream_id = $2 AND subject_id = $3 AND school_id = $4', [teacher_id, stream_id, subject_id, user.school_id]);
        if (check.rows.length > 0) return res.status(400).json({ error: "Ameshawekwa hapa." });
        const query = `INSERT INTO teacher_assignments (teacher_id, stream_id, subject_id, school_id) VALUES ($1, $2, $3, $4) RETURNING *`;
        const result = await pool.query(query, [teacher_id, stream_id, subject_id, user.school_id]);
        res.status(201).json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.delete('/api/assignments/:id', authenticateToken, async (req, res) => {
    const { id } = req.params; const user = req.user;
    try {
        let query = 'DELETE FROM teacher_assignments WHERE id = $1'; let params = [id];
        if (user.role !== 'super_admin') { query += ' AND school_id = $2'; params.push(user.school_id); }
        const result = await pool.query(query, params);
        if (result.rowCount === 0) return res.status(404).json({ error: "Haijapatikana" });
        res.json({ message: "Imefutwa" });
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));