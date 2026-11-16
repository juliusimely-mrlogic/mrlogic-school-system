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
// NAFASI YA SHULE (HALMASHAURI) NA TOP 10
// ==========================================
app.get('/api/reports/district-rankings', authenticateToken, async (req, res) => {
    const { exam_id } = req.query;
    const user = req.user;
    
    if (!exam_id) return res.status(400).json({ error: "Chagua Mtihani" });
    if (!user.school_id) return res.status(400).json({ error: "Hana shule" });

    try {
        const schoolRes = await pool.query('SELECT district FROM schools WHERE id = $1', [user.school_id]);
        const district = schoolRes.rows[0]?.district;
        if (!district) return res.status(400).json({ error: "Shule yako haina Halmashauri (District) iliyowekwa." });

        const schoolsInDistrict = await pool.query('SELECT id, name FROM schools WHERE district = $1', [district]);
        const schoolIds = schoolsInDistrict.rows.map(s => s.id);
        
        const subjectsRes = await pool.query(`SELECT id, name FROM subjects WHERE school_id = $1 ORDER BY id ASC`, [user.school_id]);
        const subjects = subjectsRes.rows;

        const resultsRes = await pool.query(`
            SELECT r.student_id, r.subject_id, r.score, st.full_name, st.gender, st.stream_id, s.name as school_name, s.id as school_id
            FROM results r 
            JOIN students st ON r.student_id = st.id 
            JOIN schools s ON st.school_id = s.id
            WHERE r.exam_id = $1 AND r.school_id = ANY($2)
        `, [exam_id, schoolIds]);

        const results = resultsRes.rows;
        const schoolStats = {}; 
        
        schoolsInDistrict.rows.forEach(sch => {
            schoolStats[sch.id] = { id: sch.id, name: sch.name, total_points: 0, count: 0, students: [] };
        });

        const studentMap = {};
        results.forEach(r => {
            if (!studentMap[r.student_id]) {
                studentMap[r.student_id] = {
                    id: r.student_id, name: r.full_name, gender: r.gender, school_id: r.school_id, school_name: r.school_name,
                    scores: [], total_points: 0, count: 0, division: '-', gpa: 0
                };
            }
            const score = parseFloat(r.score);
            const { grade, points } = getGradeAndPoints(score);
            studentMap[r.student_id].scores.push({ subject_id: r.subject_id, score: score, grade: grade, points: points });
        });

        Object.values(studentMap).forEach(student => {
            let totalPoints = 0, count = 0;
            student.scores.forEach(s => { totalPoints += s.points; count++; });
            if (count > 0) {
                student.total_points = totalPoints;
                student.division = getDivision(totalPoints);
                student.gpa = parseFloat((totalPoints / count).toFixed(2)); 
                
                const sch = schoolStats[student.school_id];
                if (sch) {
                    sch.total_points += totalPoints;
                    sch.count += count;
                    sch.students.push(student);
                }
            }
        });

        const schoolRankings = Object.values(schoolStats)
            .filter(sch => sch.count > 0) 
            .map(sch => ({
                id: sch.id, name: sch.name,
                school_gpa: parseFloat((sch.total_points / sch.count).toFixed(4)),
                total_students: sch.students.length
            }))
            .sort((a, b) => a.school_gpa - b.school_gpa);

        schoolRankings.forEach((sch, index) => {
            sch.rank = index + 1;
        });

        const ourSchoolRank = schoolRankings.find(s => s.id === user.school_id) || { rank: '-', school_gpa: '-' };
        const bestSchool = schoolRankings[0] || { name: '-', school_gpa: '-' };
        const worstSchool = schoolRankings[schoolRankings.length - 1] || { name: '-', school_gpa: '-' };

        const allStudents = Object.values(studentMap).filter(st => st.count > 0);
        
        allStudents.sort((a, b) => {
            if (a.division !== b.division) return a.division.localeCompare(b.division);
            if (a.gpa !== b.gpa) return a.gpa - b.gpa;
            return a.total_points - b.total_points;
        });

        const top10Students = allStudents.slice(0, 10).map((st, index) => {
            const subjectGrades = subjects.map(sub => {
                const s = st.scores.find(x => x.subject_id === sub.id);
                return s ? s.grade : '-';
            });

            return {
                rank: index + 1,
                name: st.name,
                gender: st.gender,
                school_name: st.school_name,
                division: st.division,
                gpa: st.gpa,
                aggt: st.total_points,
                subjects: subjectGrades
            };
        });

        res.json({
            district_name: district,
            total_schools: schoolRankings.length,
            our_school_rank: ourSchoolRank.rank,
            our_school_gpa: ourSchoolRank.school_gpa,
            best_school: bestSchool,
            worst_school: worstSchool,
            top_students: top10Students,
            subjects_list: subjects.map(s => s.name)
        });

    } catch (error) {
        console.error("District Rankings Error:", error);
        res.status(500).json({ error: "Imeshindikana kuleta takwimu za Halmashauri." });
    }
});

// ==========================================
// ANNOUNCEMENTS
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
// LOGIN (TENANT ISOLATION FIX)
// ==========================================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) return res.status(401).json({ error: "Jina la mtumiaji si sahihi" });
        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(401).json({ error: "Password si sahihi" });
        
        // Sub check
        if (user.role !== 'super_admin' && user.school_id) {
            try {
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
            } catch (err) { console.log("Subscription check skipped."); }
        }

        // HAKIKISHA TOKEN INA school_id
        const token = jwt.sign({ id: user.id, role: user.role, school_id: user.school_id, name: user.full_name }, process.env.JWT_SECRET || 'siri_yako_ya_siri', { expiresIn: '1d' });
        res.json({ token, user });
    } catch (error) { res.status(500).json({ error: "Kuna tatizo la kiufundi" }); }
});

// ==========================================
// SUBSCRIPTION
// ==========================================
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

// ==========================================
// DASHBOARD (TENANT ISOLATION KAMILI)
// ==========================================
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        let targetSchoolId = user.role === 'super_admin' ? req.query.school_id : user.school_id;
        
        if (!targetSchoolId) {
            return res.json({ schoolName: "Hakuna Shule", totalStudents: 0, totalTeachers: 0, totalClasses: 0, totalExpectedFees: 0, totalCollectedFees: 0, totalOutstandingFees: 0, overallGender: { M: 0, F: 0 }, streamGenderStats: [], examStats: {}, districtRank: "-", totalSchoolsInDistrict: 0 });
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
// WALIMU
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

// ==========================================
// WANAFUNZI
// ==========================================
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

// ==========================================
// STREAMS, SUBJECTS, EXAMS
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

// ==========================================
// FEES & RESULTS
// ==========================================
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
// REPORTS
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
// SCHOOLS (Super Admin)
// ==========================================
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
    } catch (error) { 
        console.error("School registration error:", error);
        res.status(500).json({ error: `Imeshindikana kusajili shule.` }); 
    }
});

app.get('/api/schools', authenticateToken, async (req, res) => {
    try { const result = await pool.query('SELECT * FROM schools ORDER BY name ASC'); res.json(result.rows); } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

// ==========================================
// START SERVER
// ==========================================
app.use('/api', (req, res) => { res.status(404).json({ error: "API haipo" }); });
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));