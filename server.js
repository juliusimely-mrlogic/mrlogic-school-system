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

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) return res.status(401).json({ error: "Jina la mtumiaji si sahihi" });
        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(401).json({ error: "Password si sahihi" });
        const token = jwt.sign({ id: user.id, role: user.role, school_id: user.school_id, name: user.full_name }, process.env.JWT_SECRET || 'siri_yako_ya_siri', { expiresIn: '1d' });
        res.json({ token, user });
    } catch (error) { res.status(500).json({ error: "Kuna tatizo la kiufundi" }); }
});

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

app.post('/api/schools', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa ya kusajili shule." });
    const { name, region, district, level, supervisor, second_master, academic_master, center_number, manager } = req.body;
    try {
        const check = await pool.query('SELECT id FROM schools WHERE name ILIKE $1', [name]);
        if (check.rows.length > 0) return res.status(400).json({ error: "Shule yenye jina hili imeshasajiliwa." });

        const query = `
            INSERT INTO schools (name, region, district, level, supervisor, second_master, academic_master, center_number, manager, system_fee, is_paid) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 500000, false) RETURNING *
        `;
        const result = await pool.query(query, [name, region, district, level, supervisor, second_master, academic_master, center_number, manager]);
        res.status(201).json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Imeshindikana kusajili shule." }); }
});

app.get('/api/schools', authenticateToken, async (req, res) => {
    try { const result = await pool.query('SELECT * FROM schools ORDER BY name ASC'); res.json(result.rows); } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/super-admin/system-payments', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa." });
    try {
        const result = await pool.query('SELECT id, name, district, COALESCE(system_fee, 500000) as system_fee, COALESCE(is_paid, false) as is_paid FROM schools ORDER BY is_paid ASC, name ASC');
        const schools = result.rows;
        let totalExpected = 0, totalCollected = 0, totalOutstanding = 0;
        const paidSchools = [], unpaidSchools = [];
        schools.forEach(school => {
            const fee = parseFloat(school.system_fee);
            totalExpected += fee;
            if (school.is_paid) { totalCollected += fee; paidSchools.push(school); } 
            else { totalOutstanding += fee; unpaidSchools.push(school); }
        });
        res.json({ schools, paidSchools, unpaidSchools, totalExpected, totalCollected, totalOutstanding });
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.put('/api/super-admin/toggle-payment/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa." });
    const { id } = req.params;
    try {
        const result = await pool.query('UPDATE schools SET is_paid = NOT is_paid WHERE id = $1 RETURNING *', [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Shule haijapatikana." });
        res.json({ message: "Imebadilishwa.", school: result.rows[0] });
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/super-admin/district-stats', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa." });
    try {
        const query = `SELECT sc.district, sc.id as school_id, sc.name as school_name, COUNT(st.id) as student_count FROM schools sc LEFT JOIN students st ON sc.id = st.school_id GROUP BY sc.district, sc.id, sc.name ORDER BY sc.district ASC, sc.name ASC`;
        const result = await pool.query(query);
        const districts = {};
        result.rows.forEach(row => {
            const distName = row.district ? row.district.trim() : 'Hakuna Halmashauri';
            if (!districts[distName]) districts[distName] = { district: distName, totalSchools: 0, totalStudents: 0, schools: [] };
            if (row.school_id) {
                districts[distName].totalSchools += 1;
                districts[distName].totalStudents += parseInt(row.student_count);
                districts[distName].schools.push({ id: row.school_id, name: row.school_name, studentCount: parseInt(row.student_count) });
            }
        });
        res.json(Object.values(districts));
    } catch (error) { res.status(500).json({ error: "Imeshindikana" }); }
});

app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        let targetSchoolId = user.role === 'super_admin' ? req.query.school_id : user.school_id;
        if (!targetSchoolId) {
            const firstSchool = await pool.query('SELECT id FROM schools LIMIT 1');
            if (firstSchool.rows.length > 0) targetSchoolId = firstSchool.rows[0].id;
            else return res.json({ schoolName: "Hakuna Shule", totalStudents: 0, totalTeachers: 0, totalClasses: 0, totalExpectedFees: 0, totalCollectedFees: 0, totalOutstandingFees: 0, overallGender: { M: 0, F: 0 }, streamGenderStats: [], examStats: { div1: 0, div2: 0, div3: 0, div4: 0, div0: 0, inc: 0, pass: 0, abs: 0 }, districtRank: "-", totalSchoolsInDistrict: 0 });
        }

        let schoolName = "Shule Haijulikani", districtName = null;
        try {
            const schoolResult = await pool.query(`SELECT name, district FROM schools WHERE id = $1`, [targetSchoolId]);
            if (schoolResult.rows.length > 0) { schoolName = schoolResult.rows[0].name; districtName = schoolResult.rows[0].district; }
        } catch (e) { const fallback = await pool.query(`SELECT name FROM schools WHERE id = $1`, [targetSchoolId]); if (fallback.rows.length > 0) schoolName = fallback.rows[0].name; }

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

        let examStats = { div1: 0, div2: 0, div3: 0, div4: 0, div0: 0, inc: 0, pass: 0, abs: 0 }, districtRank = "-", totalSchoolsInDistrict = 0;
        const latestExamRes = await pool.query(`SELECT id, name FROM exams WHERE school_id = $1 ORDER BY id DESC LIMIT 1`, [targetSchoolId]);
        
        if (latestExamRes.rows.length > 0) {
            const examId = latestExamRes.rows[0].id, examName = latestExamRes.rows[0].name;
            const subjRes = await pool.query(`SELECT COUNT(DISTINCT subject_id) as total FROM results WHERE exam_id = $1 AND school_id = $2`, [examId, targetSchoolId]);
            const totalSubjects = parseInt(subjRes.rows[0].total);

            if (totalSubjects > 0) {
                const resultsRes = await pool.query(`SELECT s.id, r.score FROM students s LEFT JOIN results r ON s.id = r.student_id AND r.exam_id = $1 WHERE s.school_id = $2`, [examId, targetSchoolId]);
                const studentScores = {};
                resultsRes.rows.forEach(row => { if (!studentScores[row.id]) studentScores[row.id] = []; if (row.score !== null) studentScores[row.id].push(parseFloat(row.score)); });

                Object.keys(studentScores).forEach(studentId => {
                    const scores = studentScores[studentId];
                    if (scores.length === 0) examStats.abs++;
                    else if (scores.length < totalSubjects) examStats.inc++;
                    else {
                        let totalPoints = 0, countDOrBetter = 0;
                        scores.forEach(score => { const { grade, points } = getGradeAndPoints(score); totalPoints += points; if (['A', 'B', 'C', 'D'].includes(grade)) countDOrBetter++; });
                        const div = getDivision(totalPoints);
                        if (div === 'I') examStats.div1++; else if (div === 'II') examStats.div2++; else if (div === 'III') examStats.div3++; else if (div === 'IV') examStats.div4++; else examStats.div0++;
                        if (totalPoints <= 7 && countDOrBetter >= 2) examStats.pass++; else examStats.inc++;
                    }
                });
            }
            if (districtName && examName) {
                try {
                    const schoolsInDistrict = await pool.query(`SELECT id FROM schools WHERE district = $1`, [districtName]);
                    totalSchoolsInDistrict = schoolsInDistrict.rows.length;
                    if (totalSchoolsInDistrict > 1) {
                        const ranksRes = await pool.query(`SELECT s.school_id, SUM(r.score) as total_score FROM results r JOIN students s ON r.student_id = s.id JOIN exams e ON r.exam_id = e.id WHERE e.name = $1 AND s.school_id = ANY($2) GROUP BY s.school_id ORDER BY total_score DESC`, [examName, schoolsInDistrict.rows.map(s => s.id)]);
                        const rankIndex = ranksRes.rows.findIndex(r => r.school_id === targetSchoolId);
                        if (rankIndex !== -1) districtRank = rankIndex + 1;
                    } else districtRank = 1;
                } catch (err) {}
            }
        }
        res.json({ schoolName, totalStudents, totalTeachers, totalClasses, totalExpectedFees, totalCollectedFees, totalOutstandingFees, overallGender: {M: maleCount, F: femaleCount}, streamGenderStats, examStats, role: user.role, districtRank, totalSchoolsInDistrict });
    } catch (error) { res.status(500).json({ error: "Imeshindikana" }); }
});

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
        let nameParts = full_name.trim().toLowerCase().split(/\s+/);
        let baseUsername = (nameParts[0] + (nameParts.length > 1 ? nameParts[nameParts.length - 1] : '')).replace(/[^a-z0-9]/g, '') || "teacher";
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

app.get('/api/streams', authenticateToken, async (req, res) => {
    const user = req.user; let query = `SELECT * FROM streams WHERE school_id = $1`;
    const result = await pool.query(query + ` ORDER BY name ASC`, [user.school_id || 1]); res.json(result.rows);
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
        const result = await pool.query(`SELECT s.id, s.full_name, s.admission_number, st.name as stream_name, COALESCE(st.fee_amount, 0) as expected_fee, COALESCE(SUM(f.amount), 0) as total_paid FROM students s LEFT JOIN streams st ON s.stream_id = st.id LEFT JOIN fees f ON s.id = f.student_id WHERE s.school_id = $1 GROUP BY s.id, s.full_name, s.admission_number, st.name, st.fee_amount ORDER BY s.full_name ASC`, [user.school_id || 1]);
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

app.get('/api/results/excel-template', async (req, res) => {
    try {
        const decoded = jwt.verify(req.query.token, process.env.JWT_SECRET || 'siri_yako_ya_siri');
        if (decoded.role !== 'mtaaluma' && decoded.role !== 'mtaaluma_mkuu' && decoded.role !== 'super_admin') {
            return res.status(403).send("Hauna ruhusa.");
        }
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

app.post('/api/results/upload-excel', authenticateToken, upload.single('file'), async (req, res) => {
    if (req.user.role !== 'mtaaluma' && req.user.role !== 'mtaaluma_mkuu' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: "Hauna ruhusa ya kupakia Excel." });
    }
    const { exam_id } = req.body; const user = req.user;
    if (!exam_id) return res.status(400).json({ error: "Chagua Mtihani." });
    if (!req.file) return res.status(400).json({ error: "Pakia faili." });

    try {
        const examStatus = await pool.query('SELECT is_locked FROM exams WHERE id = $1', [exam_id]);
        if (examStatus.rows.length > 0 && examStatus.rows[0].is_locked) return res.status(403).json({ error: "Matokeo yamefungwa." });

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        if (data.length === 0) return res.status(400).json({ error: "Faili ni tupu." });

        const subjectsRes = await pool.query(`SELECT id, name FROM subjects WHERE school_id = $1`, [user.school_id || 1]);
        const subjectMap = {}; subjectsRes.rows.forEach(s => subjectMap[s.name.toLowerCase()] = s.id);
        
        let successCount = 0; let errors = [];
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (let row of data) {
                const studentName = row['Jina la Mwanafunzi']?.trim();
                const streamName = row['Mkondo']?.trim();
                if (!studentName || studentName === 'Mfano: John Doe' || !streamName) continue; 

                const streamRes = await client.query(`SELECT id FROM streams WHERE LOWER(name) = LOWER($1) AND school_id = $2`, [streamName, user.school_id || 1]);
                if (streamRes.rows.length === 0) { errors.push(`Mkondo "${streamName}" haupatikani.`); continue; }
                const streamId = streamRes.rows[0].id;

                const studentRes = await client.query(`SELECT id FROM students WHERE LOWER(full_name) = LOWER($1) AND stream_id = $2 AND school_id = $3`, [studentName, streamId, user.school_id || 1]);
                if (studentRes.rows.length === 0) { errors.push(`Mwanafunzi "${studentName}" hajapatikana kwenye ${streamName}.`); continue; }
                const studentId = studentRes.rows[0].id;

                for (let subjectName in row) {
                    const subNameLower = subjectName.toLowerCase();
                    if (subjectMap[subNameLower]) {
                        const subjectId = subjectMap[subNameLower];
                        let score = parseFloat(row[subjectName]);
                        if (!isNaN(score)) {
                            if (score < 0) score = 0; if (score > 100) score = 100;
                            await client.query('DELETE FROM results WHERE student_id = $1 AND exam_id = $2 AND subject_id = $3', [studentId, exam_id, subjectId]);
                            await client.query('INSERT INTO results (student_id, exam_id, subject_id, score, school_id) VALUES ($1, $2, $3, $4, $5)', [studentId, exam_id, subjectId, score, user.school_id || 1]);
                        }
                    }
                }
                successCount++;
            }
            await client.query('COMMIT');
            res.json({ message: `Imefanikiwa ${successCount} wanafunzi.`, errors: errors.length > 0 ? errors : null });
        } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    } catch (error) { res.status(500).json({ error: `Imeshindikana: ${error.message}` }); }
});

app.post('/api/attendance', authenticateToken, async (req, res) => {
    const { records, date } = req.body; const user = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); await client.query('DELETE FROM attendance WHERE date = $1 AND school_id = $2', [date, user.school_id || 1]);
        for (let r of records) { await client.query('INSERT INTO attendance (student_id, date, status, school_id) VALUES ($1, $2, $3, $4)', [r.student_id, date, r.status, user.school_id || 1]); }
        await client.query('COMMIT'); res.json({ message: "Yamehifadhiwa" });
    } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: "Imeshindikana." }); } finally { client.release(); }
});

app.get('/api/assignments', authenticateToken, async (req, res) => {
    const user = req.user; let query = `SELECT ta.*, t.full_name as teacher_name, st.name as stream_name, sub.name as subject_name FROM teacher_assignments ta JOIN teachers t ON ta.teacher_id = t.id JOIN streams st ON ta.stream_id = st.id JOIN subjects sub ON ta.subject_id = sub.id WHERE ta.school_id = $1`;
    try { const result = await pool.query(query, [user.school_id || 1]); res.json(result.rows); } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});
app.post('/api/assignments', authenticateToken, async (req, res) => {
    const { teacher_id, stream_id, subject_id } = req.body; const user = req.user;
    try { const result = await pool.query(`INSERT INTO teacher_assignments (teacher_id, stream_id, subject_id, school_id) VALUES ($1, $2, $3, $4) RETURNING *`, [teacher_id, stream_id, subject_id, user.school_id || 1]); res.status(201).json(result.rows[0]); } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/reports/broadsheet', authenticateToken, async (req, res) => {
    const { exam_id, stream_id } = req.query; const user = req.user;
    try {
        const studentsRes = await pool.query(`SELECT id, full_name FROM students WHERE stream_id = $1 AND school_id = $2`, [stream_id, user.school_id || 1]);
        const subjectsRes = await pool.query(`SELECT DISTINCT sub.id, sub.name FROM subjects sub JOIN results r ON sub.id = r.subject_id JOIN students s ON r.student_id = s.id WHERE r.exam_id = $1 AND s.stream_id = $2 AND r.school_id = $3`, [exam_id, stream_id, user.school_id || 1]);
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
        const subjectsRes = await pool.query(`SELECT id, name FROM subjects WHERE school_id = $1`, [user.school_id || 1]);
        let studentQuery = `SELECT s.id, s.full_name, st.name as stream_name FROM students s LEFT JOIN streams st ON s.stream_id = st.id WHERE s.school_id = $1`;
        let studentParams = [user.school_id || 1];
        if (stream_id) { studentQuery += ` AND s.stream_id = $2`; studentParams.push(stream_id); }
        const studentsRes = await pool.query(studentQuery, studentParams);
        const resultsRes = await pool.query(`SELECT student_id, subject_id, score FROM results WHERE exam_id = $1 AND school_id = $2`, [exam_id, user.school_id || 1]);
        
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

app.use('/api', (req, res) => { res.status(404).json({ error: "API haipo" }); });
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));