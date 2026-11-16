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
app.use('/api/webhooks/snippe', express.raw({ type: 'application/json' }));
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
// API YA DASHIBODI (IMEREKEBISHWA KWA UHAKIKA)
// ==========================================
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        let targetSchoolId;

        // Kama ni Super Admin au District Officer, tumia aliyochagua kwenye Dropdown (query param)
        if (user.role === 'super_admin' || user.role === 'district_officer') {
            targetSchoolId = req.query.school_id;
        } else {
            // Kama ni mtumiaji wa kawaida, tumia school_id yake
            targetSchoolId = user.school_id;
        }
        
        // Kama bado haipo, chukua ya kwanza (Kinga)
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
// API YA LOGIN (IMEREKEBISHWA KWA NGUVU)
// ==========================================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) return res.status(401).json({ error: "Jina la mtumiaji si sahihi" });
        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(401).json({ error: "Password si sahihi" });
        
        let finalSchoolId = user.school_id;
        let userDistrict = user.district;

        if (!finalSchoolId && (user.role === 'teacher' || user.role === 'mtaaluma' || user.role === 'mtaaluma_mkuu')) {
            try {
                const teacherRes = await pool.query('SELECT school_id FROM teachers WHERE username = $1', [username]);
                if (teacherRes.rows.length > 0) finalSchoolId = teacherRes.rows[0].school_id;
            } catch (err) { console.log("Teacher lookup failed."); }
        }

        if (!finalSchoolId && user.role !== 'super_admin' && user.role !== 'district_officer') {
            try {
                const firstSchool = await pool.query('SELECT id FROM schools LIMIT 1');
                if (firstSchool.rows.length > 0) finalSchoolId = firstSchool.rows[0].id;
            } catch (err) { console.log("Fallback school lookup failed."); }
        }

        if (user.role !== 'super_admin' && user.role !== 'district_officer' && finalSchoolId) {
            try {
                const check = await pool.query('SELECT subscription_status, trial_end_date, subscription_end_date FROM schools WHERE id = $1', [finalSchoolId]);
                if (check.rows.length > 0) {
                    const s = check.rows[0];
                    const today = new Date();
                    if (s.subscription_status === 'TRIAL_ACTIVE' && s.trial_end_date && new Date(s.trial_end_date) < today) {
                        await pool.query("UPDATE schools SET subscription_status = 'TRIAL_EXPIRED' WHERE id = $1", [finalSchoolId]);
                    } else if (s.subscription_status === 'SUBSCRIPTION_ACTIVE' && s.subscription_end_date && new Date(s.subscription_end_date) < today) {
                        await pool.query("UPDATE schools SET subscription_status = 'SUBSCRIPTION_EXPIRED' WHERE id = $1", [finalSchoolId]);
                    }
                }
            } catch (err) { console.log("Subscription check skipped."); }
        }

        const token = jwt.sign({ 
            id: user.id, role: user.role, school_id: finalSchoolId, district: userDistrict, name: user.full_name 
        }, process.env.JWT_SECRET || 'siri_yako_ya_siri', { expiresIn: '1d' });
        
        const userResponse = { ...user, school_id: finalSchoolId };
        res.json({ token, user: userResponse });
    } catch (error) { res.status(500).json({ error: "Kuna tatizo la kiufundi" }); }
});

// ==========================================
// API YA SHULE
// ==========================================
app.get('/api/schools', authenticateToken, async (req, res) => {
    try { 
        if (req.user.role === 'district_officer') {
            const result = await pool.query('SELECT * FROM schools WHERE district = $1 ORDER BY name ASC', [req.user.district]);
            return res.json(result.rows);
        }
        const result = await pool.query('SELECT * FROM schools ORDER BY name ASC'); 
        res.json(result.rows); 
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.post('/api/schools', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa." });
    const { name, registration_number, region, district, level, supervisor, second_master, academic_master, center_number, manager } = req.body;
    try {
        if (!name) return res.status(400).json({ error: "Jina la shule linahitajika." });
        const check = await pool.query('SELECT id FROM schools WHERE name ILIKE $1', [name]);
        if (check.rows.length > 0) return res.status(400).json({ error: "Shule yenye jina hili imeshasajiliwa." });
        
        let trialDays = 14;
        try {
            const settings = await pool.query('SELECT trial_days FROM subscription_settings WHERE id = 1');
            if (settings.rows.length > 0 && settings.rows[0].trial_days) trialDays = settings.rows[0].trial_days;
        } catch (e) { console.log("Trial days check skipped."); }

        const trialStart = new Date(), trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + trialDays);

        const query = `INSERT INTO schools (name, registration_number, region, district, level, supervisor, second_master, academic_master, center_number, manager, subscription_status, trial_start_date, trial_end_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'TRIAL_ACTIVE', $11, $12) RETURNING *`;
        const result = await pool.query(query, [name, registration_number, region, district, level, supervisor, second_master, academic_master, center_number, manager, trialStart, trialEnd]);
        res.status(201).json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: `Imeshindikana kusajili shule.` }); }
});

// ==========================================
// API YA WALIMU
// ==========================================
app.get('/api/teachers', authenticateToken, async (req, res) => {
    try {
        const user = req.user; let query = `SELECT * FROM teachers`; let params = [];
        if (user.role === 'super_admin' || user.role === 'district_officer') { if (req.query.school_id) { query += ` WHERE school_id = $1`; params.push(req.query.school_id); } } 
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

// ==========================================
// API YA WANAFUNZI
// ==========================================
app.get('/api/students', authenticateToken, async (req, res) => {
    try {
        const user = req.user; let query = `SELECT * FROM students`; let params = [], conditions = [];
        if (user.role === 'super_admin' || user.role === 'district_officer') { if (req.query.school_id) { conditions.push(`school_id = $${params.length + 1}`); params.push(req.query.school_id); } } 
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

// ==========================================
// API YA MIPANGILIO, ADA NA ALAMA
// ==========================================
app.get('/api/streams', authenticateToken, async (req, res) => {
    const user = req.user; 
    try {
        const result = await pool.query(`SELECT * FROM streams WHERE school_id = $1 ORDER BY name ASC`, [user.school_id]); 
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});
app.post('/api/streams', authenticateToken, async (req, res) => {
    const { name, fee_amount } = req.body; const user = req.user;
    try { const result = await pool.query(`INSERT INTO streams (name, fee_amount, school_id) VALUES ($1, $2, $3) RETURNING *`, [name, fee_amount || 0, user.school_id]); res.status(201).json(result.rows[0]); } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/subjects', authenticateToken, async (req, res) => {
    const user = req.user; 
    try {
        const result = await pool.query(`SELECT * FROM subjects WHERE school_id = $1 ORDER BY name ASC`, [user.school_id]); 
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});
app.post('/api/subjects', authenticateToken, async (req, res) => {
    const { name } = req.body; const user = req.user;
    try { const result = await pool.query(`INSERT INTO subjects (name, school_id) VALUES ($1, $2) RETURNING *`, [name, user.school_id]); res.status(201).json(result.rows[0]); } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/exams', authenticateToken, async (req, res) => {
    const user = req.user; 
    try {
        const result = await pool.query(`SELECT id, name, is_locked FROM exams WHERE school_id = $1 ORDER BY id DESC`, [user.school_id]); 
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});
app.post('/api/exams', authenticateToken, async (req, res) => {
    const { name } = req.body; const user = req.user;
    try { const result = await pool.query(`INSERT INTO exams (name, school_id) VALUES ($1, $2) RETURNING *`, [name, user.school_id]); res.status(201).json(result.rows[0]); } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/fees/balances', authenticateToken, async (req, res) => {
    const user = req.user;
    try {
        const result = await pool.query(`SELECT s.id, s.full_name, st.name as stream_name, COALESCE(st.fee_amount, 0) as expected_fee, COALESCE(SUM(f.amount), 0) as total_paid FROM students s LEFT JOIN streams st ON s.stream_id = st.id LEFT JOIN fees f ON s.id = f.student_id WHERE s.school_id = $1 GROUP BY s.id, s.full_name, st.name, st.fee_amount`, [user.school_id]);
        res.json(result.rows.map(row => ({ ...row, balance: parseFloat(row.expected_fee) - parseFloat(row.total_paid) })));
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});
app.post('/api/fees', authenticateToken, async (req, res) => {
    const { student_id, amount, date_paid } = req.body; const user = req.user;
    try { const result = await pool.query(`INSERT INTO fees (student_id, amount, date_paid, school_id) VALUES ($1, $2, $3, $4) RETURNING *`, [student_id, amount, date_paid, user.school_id]); res.status(201).json(result.rows[0]); } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/results/existing', authenticateToken, async (req, res) => {
    const { exam_id, subject_id, stream_id } = req.query; const user = req.user;
    try { const result = await pool.query(`SELECT r.student_id, r.score FROM results r JOIN students s ON r.student_id = s.id WHERE r.exam_id = $1 AND r.subject_id = $2 AND s.stream_id = $3 AND r.school_id = $4`, [exam_id, subject_id, stream_id, user.school_id]); res.json(result.rows); } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});
app.post('/api/results', authenticateToken, async (req, res) => {
    const { exam_id, subject_id, marks } = req.body; const user = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM results WHERE exam_id = $1 AND subject_id = $2 AND school_id = $3', [exam_id, subject_id, user.school_id]);
        for (let record of marks) { if (record.score !== '' && record.score !== null) { await client.query('INSERT INTO results (student_id, exam_id, subject_id, score, school_id) VALUES ($1, $2, $3, $4, $5)', [record.student_id, exam_id, subject_id, record.score, user.school_id]); } }
        await client.query('COMMIT'); res.json({ message: "Yamehifadhiwa" });
    } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: "Imeshindikana." }); } finally { client.release(); }
});

// ==========================================
// API ZA RIPOTI
// ==========================================
app.get('/api/reports/broadsheet', authenticateToken, async (req, res) => {
    const { exam_id, stream_id } = req.query; const user = req.user;
    try {
        const studentsRes = await pool.query(`SELECT id, full_name FROM students WHERE stream_id = $1 AND school_id = $2`, [stream_id, user.school_id]);
        const subjectsRes = await pool.query(`SELECT DISTINCT sub.id, sub.name FROM subjects sub JOIN results r ON sub.id = r.subject_id JOIN students s ON r.student_id = s.id WHERE r.exam_id = $1 AND s.stream_id = $2 AND r.school_id = $3`, [exam_id, stream_id, user.school_id]);
        const resultsRes = await pool.query(`SELECT r.student_id, r.subject_id, r.score FROM results r JOIN students s ON r.student_id = s.id WHERE r.exam_id = $1 AND s.stream_id = $2`, [exam_id, stream_id]);
        const reportData = studentsRes.rows.map(st => {
            let total = 0, points = 0, count = 0; const scores = {};
            subjectsRes.rows.forEach(sub => {
                const r = resultsRes.rows.find(x => x.student_id === st.id && x.subject_id === sub.id);
                if (r) { const sc = parseFloat(r.score); const g = getGradeAndPoints(sc); scores[sub.id] = { score: sc, grade: g.grade }; total += sc; points += g.points; count++; }
                else scores[sub.id] = { score: null, grade: '-' };
            });
            return { student_id: st.id, full_name: st.full_name, scores, total, points, division: getDivision(points), average: count > 0 ? (total / count).toFixed(2) : 0 };
        }).sort((a, b) => b.average - a.average);
        reportData.forEach((r, i) => r.position = i + 1);
        res.json({ subjects: subjectsRes.rows, reportData });
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/reports/top-students', authenticateToken, async (req, res) => {
    const { exam_id, stream_id, type } = req.query; const user = req.user;
    try {
        const subjectsRes = await pool.query(`SELECT id, name FROM subjects WHERE school_id = $1`, [user.school_id]);
        let studentQuery = `SELECT s.id, s.full_name, st.name as stream_name FROM students s LEFT JOIN streams st ON s.stream_id = st.id WHERE s.school_id = $1`;
        let studentParams = [user.school_id];
        if (stream_id) { studentQuery += ` AND s.stream_id = $2`; studentParams.push(stream_id); }
        const studentsRes = await pool.query(studentQuery, studentParams);
        const resultsRes = await pool.query(`SELECT student_id, subject_id, score FROM results WHERE exam_id = $1 AND school_id = $2`, [exam_id, user.school_id]);
        const reportData = studentsRes.rows.map(student => {
            let totalScore = 0, subjectsCount = 0, totalPoints = 0; const scoresDetail = {};
            subjectsRes.rows.forEach(sub => {
                const result = resultsRes.rows.find(r => r.student_id === student.id && r.subject_id === sub.id);
                if (result) { const score = parseFloat(result.score); const { grade, points } = getGradeAndPoints(score); scoresDetail[sub.name] = { score, grade, points }; totalScore += score; totalPoints += points; subjectsCount++; }
            });
            const average = subjectsCount > 0 ? parseFloat((totalScore / subjectsCount).toFixed(2)) : 0;
            const division = subjectsCount > 0 ? getDivision(totalPoints) : '-';
            return { student_id: student.id, full_name: student.full_name, stream_name: student.stream_name || 'Hajapewa', average, division };
        });
        if (type === 'worst') reportData.sort((a, b) => a.average - b.average);
        else reportData.sort((a, b) => b.average - a.average);
        const top50 = reportData.slice(0, 50);
        top50.forEach((row, index) => { row.rank = index + 1; });
        res.json({ reportData: top50 });
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

// ==========================================
// API YA EXCEL NA MAHUDHURIO
// ==========================================
app.get('/api/results/excel-template', async (req, res) => {
    try {
        const decoded = jwt.verify(req.query.token, process.env.JWT_SECRET || 'siri_yako_ya_siri');
        if (decoded.role !== 'mtaaluma' && decoded.role !== 'mtaaluma_mkuu' && decoded.role !== 'super_admin') return res.status(403).send("Hauna ruhusa.");
        const subjectsRes = await pool.query(`SELECT name FROM subjects WHERE school_id = $1 ORDER BY name ASC`, [decoded.school_id]);
        const headers = ['Jina la Mwanafunzi', 'Jinsia', 'Mkondo', ...subjectsRes.rows.map(s => s.name)];
        const sampleRow = ['Mfano: John Doe', 'M', 'Stream A', ...headers.slice(3).map(()=>70)];
        const ws = xlsx.utils.aoa_to_sheet([headers, sampleRow]);
        const wb = xlsx.utils.book_new(); xlsx.utils.book_append_sheet(wb, ws, "Template_Alama");
        const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', `attachment; filename="Template_Alama.xlsx"`); 
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch (error) { res.status(500).send("Imeshindikana."); }
});

app.get('/api/assignments', authenticateToken, async (req, res) => {
    const user = req.user; let query = `SELECT ta.*, t.full_name as teacher_name, st.name as stream_name, sub.name as subject_name FROM teacher_assignments ta JOIN teachers t ON ta.teacher_id = t.id JOIN streams st ON ta.stream_id = st.id JOIN subjects sub ON ta.subject_id = sub.id WHERE ta.school_id = $1`;
    try { const result = await pool.query(query, [user.school_id]); res.json(result.rows); } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});
app.post('/api/assignments', authenticateToken, async (req, res) => {
    const { teacher_id, stream_id, subject_id } = req.body; const user = req.user;
    try { const result = await pool.query(`INSERT INTO teacher_assignments (teacher_id, stream_id, subject_id, school_id) VALUES ($1, $2, $3, $4) RETURNING *`, [teacher_id, stream_id, subject_id, user.school_id]); res.status(201).json(result.rows[0]); } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

// ==========================================
// API ZA SUBSCRIPTION NA ANNOUNCEMENTS
// ==========================================
app.get('/api/public/announcements', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const result = await pool.query(`SELECT id, message_sw, message_en FROM login_announcements WHERE is_active = true AND start_date <= $1 AND end_date >= $1 AND target_role = 'all' ORDER BY created_at DESC LIMIT 1`, [today]);
        res.json(result.rows);
    } catch (error) { res.json([]); }
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

app.get('/api/subscriptions/settings', authenticateToken, async (req, res) => {
    try { 
        const result = await pool.query('SELECT * FROM subscription_settings WHERE id = 1');
        if (result.rows.length > 0) res.json(result.rows[0]); 
        else res.json({ annual_fee: 500000, duration_months: 12, trial_days: 14, support_whatsapp: '+255700000000', instructions_sw: 'Lipa ada.', gateway_provider: 'SNIPPE' });
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.put('/api/admin/subscriptions/settings', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa." });
    const { annual_fee, duration_months, trial_days, support_whatsapp, instructions_sw, gateway_provider, gateway_api_key, gateway_webhook_secret } = req.body;
    try {
        const check = await pool.query('SELECT id FROM subscription_settings WHERE id = 1');
        if (check.rows.length === 0) {
            await pool.query(`INSERT INTO subscription_settings (id, annual_fee, duration_months, trial_days, support_whatsapp, instructions_sw, gateway_provider, gateway_api_key, gateway_webhook_secret) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)`, [annual_fee, duration_months, trial_days, support_whatsapp, instructions_sw, gateway_provider, gateway_api_key, gateway_webhook_secret]);
        } else {
            await pool.query(`UPDATE subscription_settings SET annual_fee=$1, duration_months=$2, trial_days=$3, support_whatsapp=$4, instructions_sw=$5, gateway_provider=$6, gateway_api_key=$7, gateway_webhook_secret=$8 WHERE id = 1`, [annual_fee, duration_months, trial_days, support_whatsapp, instructions_sw, gateway_provider, gateway_api_key, gateway_webhook_secret]);
        }
        res.json({ message: "Mipangilio imehifadhiwa!" });
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/subscriptions/my-subscription', authenticateToken, async (req, res) => {
    if (!req.user.school_id) return res.status(400).json({ error: "Hana shule." });
    try {
        const school = await pool.query('SELECT name, subscription_status, trial_start_date, trial_end_date, subscription_start_date, subscription_end_date FROM schools WHERE id = $1', [req.user.school_id]);
        const settings = await pool.query('SELECT * FROM subscription_settings WHERE id = 1');
        const payments = await pool.query('SELECT * FROM payment_transactions WHERE school_id = $1 ORDER BY created_at DESC', [req.user.school_id]).catch(() => ({ rows: [] }));
        res.json({ school: school.rows[0], settings: settings.rows[0] || {}, payments: payments.rows });
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.post('/api/subscriptions/payments', authenticateToken, async (req, res) => {
    if (!req.user.school_id) return res.status(400).json({ error: "Hana shule." });
    const { phone_number } = req.body; 
    try {
        const settings = await pool.query('SELECT * FROM subscription_settings WHERE id = 1');
        const amount = settings.rows[0]?.annual_fee || 500000;
        const internalRef = 'SCH-' + req.user.school_id + '-' + Date.now();
        await pool.query(`INSERT INTO payment_transactions (school_id, internal_reference, amount, status, phone_number) VALUES ($1, $2, $3, 'INITIATED', $4)`, [req.user.school_id, internalRef, amount, phone_number]);
        const providerRef = 'PRV-' + Math.floor(Math.random() * 1000000); 
        await pool.query(`UPDATE payment_transactions SET status = 'PENDING', provider_reference = $1 WHERE internal_reference = $2`, [providerRef, internalRef]);
        res.json({ message: "Malipo yameanzishwa.", reference: internalRef });
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.post('/api/webhooks/snippe', async (req, res) => {
    try {
        const settings = await pool.query('SELECT gateway_webhook_secret FROM subscription_settings WHERE id = 1');
        const secret = settings.rows[0]?.gateway_webhook_secret;
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
            const providerRef = event.data.reference, amountPaid = event.data.amount;
            const txResult = await pool.query('SELECT * FROM payment_transactions WHERE provider_reference = $1 AND status = $2', [providerRef, 'PENDING']);
            if (txResult.rows.length > 0) {
                const tx = txResult.rows[0];
                if (parseFloat(amountPaid) !== parseFloat(tx.amount)) {
                    await pool.query('UPDATE payment_transactions SET status = $1 WHERE id = $2', ['REVIEW_REQUIRED', tx.id]);
                    return res.status(200).json({ message: "Amount mismatch." });
                }
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    await client.query('UPDATE payment_transactions SET status = $1, updated_at = NOW() WHERE id = $2', ['SUCCESS', tx.id]);
                    const schoolResult = await client.query('SELECT subscription_status, subscription_end_date FROM schools WHERE id = $1', [tx.school_id]);
                    const school = schoolResult.rows[0];
                    let newStartDate = new Date(), newEndDate = new Date();
                    newEndDate.setFullYear(newStartDate.getFullYear() + 1); 
                    if (school.subscription_status === 'SUBSCRIPTION_ACTIVE' && school.subscription_end_date) {
                        newStartDate = new Date(school.subscription_end_date);
                        newEndDate = new Date(newStartDate);
                        newEndDate.setFullYear(newEndDate.getFullYear() + 1);
                    }
                    await client.query(`UPDATE schools SET subscription_status = 'SUBSCRIPTION_ACTIVE', subscription_start_date = $1, subscription_end_date = $2 WHERE id = $3`, [newStartDate, newEndDate, tx.school_id]);
                    await client.query('COMMIT');
                } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
            }
        }
        res.status(200).json({ message: "Webhook processed." });
    } catch (error) { res.status(500).json({ error: "Internal server error." }); }
});

app.use('/api', (req, res) => { res.status(404).json({ error: "API haipo" }); });
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));