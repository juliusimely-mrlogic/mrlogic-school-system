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

// Function ya kupata Grade na Pointi
const getGradeAndPoints = (score) => {
    if (score >= 75) return { grade: 'A', points: 1 };
    if (score >= 65) return { grade: 'B', points: 2 };
    if (score >= 45) return { grade: 'C', points: 3 };
    if (score >= 30) return { grade: 'D', points: 4 };
    return { grade: 'F', points: 5 };
};

// Function ya kupata Daraja (Division)
const getDivision = (points) => {
    if (points >= 7 && points <= 17) return 'I';
    if (points >= 18 && points <= 21) return 'II';
    if (points >= 22 && points <= 25) return 'III';
    if (points >= 26 && points <= 33) return 'IV';
    return '0';
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
        
        if (!targetSchoolId) {
            return res.json({ 
                schoolName: "Chagua Shule", totalStudents: 0, totalTeachers: 0, totalClasses: 0, 
                totalExpectedFees: 0, totalCollectedFees: 0, totalOutstandingFees: 0,
                overallGender: { M: 0, F: 0 }, streamGenderStats: [],
                examStats: { div1: 0, div2: 0, div3: 0, div4: 0, div0: 0, inc: 0, pass: 0, abs: 0 }
            });
        }

        const schoolResult = await pool.query(`SELECT name FROM schools WHERE id = $1`, [targetSchoolId]);
        const schoolName = schoolResult.rows.length > 0 ? schoolResult.rows[0].name : "Shule Haijulikani";

        const [studentsRes, teachersRes, classesRes] = await Promise.all([
            pool.query(`SELECT id, gender, stream_id FROM students WHERE school_id = $1`, [targetSchoolId]),
            pool.query(`SELECT COUNT(*) FROM teachers WHERE school_id = $1`, [targetSchoolId]),
            pool.query(`SELECT id, name, fee_amount FROM streams WHERE school_id = $1`, [targetSchoolId])
        ]);

        const totalStudents = studentsRes.rows.length;
        const totalTeachers = parseInt(teachersRes.rows[0].count);
        const totalClasses = classesRes.rows.length;

        let totalExpectedFees = 0;
        studentsRes.rows.forEach(student => {
            const stream = classesRes.rows.find(s => s.id === student.stream_id);
            if (stream) totalExpectedFees += parseFloat(stream.fee_amount || 0);
        });

        const currentYear = new Date().getFullYear();
        const collectedRes = await pool.query(`
            SELECT COALESCE(SUM(amount), 0) as total 
            FROM fees WHERE school_id = $1 AND EXTRACT(YEAR FROM date_paid) = $2
        `, [targetSchoolId, currentYear]);
        
        const totalCollectedFees = parseFloat(collectedRes.rows[0].total);
        const totalOutstandingFees = totalExpectedFees - totalCollectedFees;

        let maleCount = 0;
        let femaleCount = 0;
        studentsRes.rows.forEach(s => {
            if (s.gender === 'M') maleCount++;
            if (s.gender === 'F') femaleCount++;
        });
        const overallGender = { M: maleCount, F: femaleCount };

        const streamGenderStats = classesRes.rows.map(stream => {
            const streamStudents = studentsRes.rows.filter(s => s.stream_id === stream.id);
            return {
                stream_name: stream.name,
                male: streamStudents.filter(s => s.gender === 'M').length,
                female: streamStudents.filter(s => s.gender === 'F').length
            };
        });

        let examStats = { div1: 0, div2: 0, div3: 0, div4: 0, div0: 0, inc: 0, pass: 0, abs: 0 };
        
        const latestExamRes = await pool.query(`SELECT id FROM exams WHERE school_id = $1 ORDER BY id DESC LIMIT 1`, [targetSchoolId]);
        
        if (latestExamRes.rows.length > 0) {
            const examId = latestExamRes.rows[0].id;
            const subjRes = await pool.query(`SELECT COUNT(DISTINCT subject_id) as total FROM results WHERE exam_id = $1 AND school_id = $2`, [examId, targetSchoolId]);
            const totalSubjects = parseInt(subjRes.rows[0].total);

            if (totalSubjects > 0) {
                const resultsRes = await pool.query(`
                    SELECT s.id, r.score 
                    FROM students s 
                    LEFT JOIN results r ON s.id = r.student_id AND r.exam_id = $1
                    WHERE s.school_id = $2
                `, [examId, targetSchoolId]);

                const studentScores = {};
                resultsRes.rows.forEach(row => {
                    if (!studentScores[row.id]) studentScores[row.id] = [];
                    if (row.score !== null) studentScores[row.id].push(parseFloat(row.score));
                });

                Object.keys(studentScores).forEach(studentId => {
                    const scores = studentScores[studentId];
                    if (scores.length === 0) {
                        examStats.abs++;
                    } else if (scores.length < totalSubjects) {
                        examStats.inc++;
                    } else {
                        let totalPoints = 0;
                        let countDOrBetter = 0;

                        scores.forEach(score => {
                            const { grade, points } = getGradeAndPoints(score);
                            totalPoints += points;
                            if (['A', 'B', 'C', 'D'].includes(grade)) countDOrBetter++;
                        });

                        const div = getDivision(totalPoints);
                        if (div === 'I') examStats.div1++;
                        else if (div === 'II') examStats.div2++;
                        else if (div === 'III') examStats.div3++;
                        else if (div === 'IV') examStats.div4++;
                        else examStats.div0++;

                        if (totalPoints <= 7 && countDOrBetter >= 2) {
                            examStats.pass++;
                        } else {
                            examStats.inc++;
                        }
                    }
                });
            }
        }

        res.json({
            schoolName: schoolName, totalStudents: totalStudents, totalTeachers: totalTeachers,
            totalClasses: totalClasses, totalExpectedFees: totalExpectedFees, totalCollectedFees: totalCollectedFees,
            totalOutstandingFees: totalOutstandingFees, overallGender: overallGender, streamGenderStats: streamGenderStats,
            examStats: examStats, role: user.role
        });

    } catch (error) { 
        console.error("Dashboard Stats Error:", error);
        res.status(500).json({ error: "Imeshindikana kupata takwimu" }); 
    }
});

// 3. API YA RIPOTI ZA WANAFUNZI
app.get('/api/reports/failed-students', authenticateToken, async (req, res) => {
    const { exam_id, stream_id } = req.query;
    const user = req.user;
    if (!exam_id) return res.status(400).json({ error: "Chagua Mtihani" });
    if (!user.school_id) return res.status(400).json({ error: "Hana shule" });

    try {
        let totalFQuery = `SELECT COUNT(*) as total_f FROM results WHERE exam_id = $1 AND school_id = $2 AND score < 30`;
        let totalFParams = [exam_id, user.school_id];
        if (stream_id) {
             totalFQuery += ` AND student_id IN (SELECT id FROM students WHERE stream_id = $3)`;
             totalFParams.push(stream_id);
        }
        const totalFRes = await pool.query(totalFQuery, totalFParams);
        const totalFs = parseInt(totalFRes.rows[0].total_f);

        let studentQuery = `SELECT s.id, s.full_name, s.gender, s.stream_id, st.name as stream_name FROM students s LEFT JOIN streams st ON s.stream_id = st.id WHERE s.school_id = $1`;
        let studentParams = [user.school_id];
        if (stream_id) { studentQuery += ` AND s.stream_id = $2`; studentParams.push(stream_id); }
        
        const studentsRes = await pool.query(studentQuery, studentParams);
        const resultsRes = await pool.query(`SELECT student_id, subject_id, score FROM results WHERE exam_id = $1 AND school_id = $2`, [exam_id, user.school_id]);
        const subjectsRes = await pool.query(`SELECT id, name FROM subjects WHERE school_id = $1`, [user.school_id]);
        const subjectMap = {};
        subjectsRes.rows.forEach(sub => subjectMap[sub.id] = sub.name);

        let failedStudents = [];
        
        studentsRes.rows.forEach(student => {
            const studentResults = resultsRes.rows.filter(r => r.student_id === student.id);
            if (studentResults.length === 0) return;

            let allF = true;
            let failedSubjects = [];
            let totalScore = 0;

            studentResults.forEach(r => {
                const score = parseFloat(r.score);
                totalScore += score;
                if (score >= 30) { 
                    allF = false;
                } else {
                    const subName = subjectMap[r.subject_id] || 'SUB';
                    failedSubjects.push({ code: subName.substring(0, 3).toUpperCase(), grade: 'F' });
                }
            });

            if (allF) {
                failedStudents.push({
                    student_id: student.id,
                    full_name: student.full_name,
                    gender: student.gender,
                    stream_name: student.stream_name || 'Hajapewa',
                    total_score: totalScore,
                    failed_subjects: failedSubjects
                });
            }
        });

        failedStudents.sort((a, b) => a.total_score - b.total_score);
        failedStudents.forEach((s, idx) => s.rank = idx + 1);

        res.json({ totalFs, failedStudents });
    } catch (error) { res.status(500).json({ error: "Imeshindikana kuleta data" }); }
});

// 4. API YA WANAFUNZI
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

// 5. API YA WALIMU (NA MAJUKUMU)
app.get('/api/teachers', authenticateToken, async (req, res) => {
    try {
        const user = req.user; let query = `SELECT * FROM teachers`; let params = [];
        if (user.role === 'super_admin') { if (req.query.school_id) { query += ` WHERE school_id = $1`; params.push(req.query.school_id); } } 
        else { if (!user.school_id) return res.status(400).json({ error: "Hana shule" }); query += ` WHERE school_id = $1`; params.push(user.school_id); }
        query += ` ORDER BY full_name ASC`; const result = await pool.query(query, params); res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.post('/api/teachers', authenticateToken, async (req, res) => {
    const { full_name, gender, phone, designation } = req.body; const user = req.user;
    if (!user.school_id) return res.status(400).json({ error: "Hana shule" });
    const client = await pool.connect();
    try {
        let nameParts = full_name.trim().toLowerCase().split(/\s+/);
        let firstName = nameParts[0] || '';
        let lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
        let baseUsername = (firstName + lastName).replace(/[^a-z0-9]/g, '');
        if (!baseUsername) baseUsername = "teacher";
        let username = baseUsername; let counter = 1;
        let checkUser = await client.query('SELECT * FROM users WHERE username = $1', [username]);
        while (checkUser.rows.length > 0) { username = baseUsername + counter; counter++; checkUser = await client.query('SELECT * FROM users WHERE username = $1', [username]); }
        await client.query('BEGIN');
        const query = `INSERT INTO teachers (full_name, gender, phone, username, school_id, designation) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
        const result = await client.query(query, [full_name, gender, phone, username, user.school_id, designation || 'Mwalimu']);
        const salt = await bcrypt.genSalt(10); const hashedPassword = await bcrypt.hash('password123', salt);
        await client.query(`INSERT INTO users (full_name, username, password_hash, role, school_id) VALUES ($1, $2, $3, $4, $5)`, [full_name, username, hashedPassword, 'teacher', user.school_id]);
        await client.query('COMMIT');
        res.status(201).json({ ...result.rows[0], username });
    } catch (error) { 
        await client.query('ROLLBACK');
        res.status(500).json({ error: "Imeshindikana. Hakikisha column 'designation' ipo." }); 
    } finally { client.release(); }
});

app.put('/api/teachers/:id', authenticateToken, async (req, res) => {
    const { id } = req.params; const { full_name, gender, phone, designation } = req.body; const user = req.user;
    try {
        let query = `UPDATE teachers SET full_name=$1, gender=$2, phone=$3, designation=$4 WHERE id=$5`; 
        let params = [full_name, gender, phone, designation, id];
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

// 6. API YA MADARASA (STREAMS)
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
        const check = await pool.query('SELECT id FROM streams WHERE name ILIKE $1 AND school_id = $2', [name, user.school_id]);
        if (check.rows.length > 0) return res.status(400).json({ error: "Darasa lenye jina hili limeshasajiliwa." });
        const query = `INSERT INTO streams (name, fee_amount, school_id) VALUES ($1, $2, $3) RETURNING *`;
        const result = await pool.query(query, [name, fee_amount || 0, user.school_id]);
        res.status(201).json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.put('/api/streams/:id', authenticateToken, async (req, res) => {
    const { id } = req.params; const { name, fee_amount } = req.body; const user = req.user;
    try {
        let query = `UPDATE streams SET name=$1, fee_amount=$2 WHERE id=$3`; let params = [name, fee_amount, id];
        if (user.role !== 'super_admin') { query += ` AND school_id=$4`; params.push(user.school_id); }
        query += ` RETURNING *`; 
        const result = await pool.query(query, params);
        if (result.rowCount === 0) return res.status(404).json({ error: "Darasa haijapatikana" });
        res.json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.delete('/api/streams/:id', authenticateToken, async (req, res) => {
    const { id } = req.params; const user = req.user;
    try {
        let query = `DELETE FROM streams WHERE id=$1`; let params = [id];
        if (user.role !== 'super_admin') { query += ` AND school_id=$2`; params.push(user.school_id); }
        const result = await pool.query(query, params);
        if (result.rowCount === 0) return res.status(404).json({ error: "Hajapatikana" });
        res.json({ message: "Darasa limefutwa" });
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

// 7. API YA MALIPO NA ADA (FEES)
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
        res.status(201).json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.delete('/api/fees/:id', authenticateToken, async (req, res) => {
    const { id } = req.params; const user = req.user;
    try {
        let query = `DELETE FROM fees WHERE id=$1`; let params = [id];
        if (user.role !== 'super_admin') { query += ` AND school_id=$2`; params.push(user.school_id); }
        const result = await pool.query(query, params);
        if (result.rowCount === 0) return res.status(404).json({ error: "Malipo haya hayapatikani." });
        res.json({ message: "Malipo yamefutwa." });
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
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

app.get('/api/fees/student-summary/:student_id', authenticateToken, async (req, res) => {
    const { student_id } = req.params; const user = req.user;
    if (!user.school_id) return res.status(400).json({ error: "Hana shule" });
    try {
        const studentRes = await pool.query(`SELECT s.id, s.full_name, s.admission_number, st.name as stream_name, COALESCE(st.fee_amount, 0) as expected_fee FROM students s LEFT JOIN streams st ON s.stream_id = st.id WHERE s.id = $1 AND s.school_id = $2`, [student_id, user.school_id]);
        if (studentRes.rows.length === 0) return res.status(404).json({ error: "Mwanafunzi hajapatikana" });
        const studentData = studentRes.rows[0];
        const feesRes = await pool.query(`SELECT id, amount, date_paid FROM fees WHERE student_id = $1 ORDER BY date_paid ASC, id ASC`, [student_id]);
        let total_paid = 0;
        const installments = feesRes.rows.map((fee, index) => {
            total_paid += parseFloat(fee.amount);
            return { id: fee.id, awamu: index + 1, amount: parseFloat(fee.amount), date_paid: fee.date_paid };
        });
        const balance = parseFloat(studentData.expected_fee) - total_paid;
        res.json({ student: studentData, installments: installments, total_paid: total_paid, balance: balance });
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/fees/receipt/:id', authenticateToken, async (req, res) => {
    const { id } = req.params; const user = req.user;
    if (!user.school_id) return res.status(400).json({ error: "Hana shule" });
    try {
        const feeRes = await pool.query(`SELECT f.id as receipt_no, f.amount as amount_paid, f.date_paid, f.student_id, s.full_name as student_name, s.admission_number, st.name as stream_name, COALESCE(st.fee_amount, 0) as expected_fee, sch.name as school_name FROM fees f JOIN students s ON f.student_id = s.id LEFT JOIN streams st ON s.stream_id = st.id JOIN schools sch ON f.school_id = sch.id WHERE f.id = $1 AND f.school_id = $2`, [id, user.school_id]);
        if (feeRes.rows.length === 0) return res.status(404).json({ error: "Risiti haijapatikana" });
        const data = feeRes.rows[0];
        const totalPaidRes = await pool.query(`SELECT COALESCE(SUM(amount), 0) as total_paid FROM fees WHERE student_id = $1`, [data.student_id]);
        const total_paid = parseFloat(totalPaidRes.rows[0].total_paid);
        const balance = parseFloat(data.expected_fee) - total_paid;
        res.json({ ...data, total_paid: total_paid, balance: balance });
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

// 8. API YA MASOMO NA MITIHANI
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

app.get('/api/exams', authenticateToken, async (req, res) => {
    try {
        const user = req.user; let query = `SELECT id, name, is_locked FROM exams`; let params = [];
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

app.put('/api/exams/:id/lock', authenticateToken, async (req, res) => {
    const { id } = req.params; const user = req.user;
    if (user.role !== 'mtaaluma_mkuu' && user.role !== 'super_admin') return res.status(403).json({ error: "Ni Mtaaluma Mkuu pekee anayeruhusiwa kuachia matokeo." });
    try {
        await pool.query('UPDATE exams SET is_locked = TRUE WHERE id = $1 AND school_id = $2', [id, user.school_id]);
        res.json({ message: "Matokeo yamefungwa kikamilifu." });
    } catch (error) { res.status(500).json({ error: "Imeshindikana kufunga matokeo." }); }
});

// 9. API YA ALAMA (MANUAL & EXCEL)
app.get('/api/results/existing', authenticateToken, async (req, res) => {
    const { exam_id, subject_id, stream_id } = req.query;
    const user = req.user;
    if (!exam_id || !subject_id || !stream_id) return res.status(400).json({ error: "Chagua Mtihani, Somo na Darasa." });
    try {
        const result = await pool.query(`SELECT r.student_id, r.score FROM results r JOIN students s ON r.student_id = s.id WHERE r.exam_id = $1 AND r.subject_id = $2 AND s.stream_id = $3 AND r.school_id = $4`, [exam_id, subject_id, stream_id, user.school_id]);
        res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana kuleta alama zilizopo." }); }
});

app.post('/api/results', authenticateToken, async (req, res) => {
    const { exam_id, subject_id, marks } = req.body; const user = req.user;
    if (!user.school_id) return res.status(400).json({ error: "Hana shule" });
    try {
        const examStatus = await pool.query('SELECT is_locked FROM exams WHERE id = $1', [exam_id]);
        if (examStatus.rows.length > 0 && examStatus.rows[0].is_locked) return res.status(403).json({ error: "Matokeo yamefungwa." });

        for (let record of marks) {
            if (record.score !== '' && record.score !== null) {
                const scoreVal = parseFloat(record.score);
                if (scoreVal < 0 || scoreVal > 100) return res.status(400).json({ error: "Alama hazipaswi kuzidi 100 au kuwa chini ya 0." });
            }
        }
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('DELETE FROM results WHERE exam_id = $1 AND subject_id = $2 AND school_id = $3', [exam_id, subject_id, user.school_id]);
            for (let record of marks) { 
                if (record.score !== '' && record.score !== null) { 
                    await client.query('INSERT INTO results (student_id, exam_id, subject_id, score, school_id) VALUES ($1, $2, $3, $4, $5)', [record.student_id, exam_id, subject_id, record.score, user.school_id]); 
                } 
            }
            await client.query('COMMIT'); res.json({ message: "Yamehifadhiwa" });
        } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/results/excel-template', async (req, res) => {
    const token = req.query.token;
    if (!token) return res.status(401).send("Hakuna token");
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'siri_yako_ya_siri');
        if (decoded.role !== 'mtaaluma' && decoded.role !== 'mtaaluma_mkuu' && decoded.role !== 'super_admin') return res.status(403).send("Hauna ruhusa.");
        const subjectsRes = await pool.query(`SELECT name FROM subjects WHERE school_id = $1 ORDER BY name ASC`, [decoded.school_id]);
        const subjects = subjectsRes.rows.map(s => s.name);
        const headers = ['Jina la Mwanafunzi', 'Jinsia', ...subjects];
        const sampleRow = ['Mfano: John Doe', 'M', 80, 75, 60]; 
        while (sampleRow.length < headers.length) sampleRow.push(70); 
        const ws = xlsx.utils.aoa_to_sheet([headers, sampleRow]);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, "Template_Ya_Alama");
        const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', `attachment; filename="Template_Alama.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch (error) { res.status(500).send("Imeshindikana kutengeneza template."); }
});

app.post('/api/results/upload-excel', authenticateToken, upload.single('file'), async (req, res) => {
    if (req.user.role !== 'mtaaluma' && req.user.role !== 'mtaaluma_mkuu' && req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa." });
    const { exam_id, stream_id } = req.body; const user = req.user;
    if (!exam_id || !stream_id) return res.status(400).json({ error: "Chagua Mtihani na Darasa." });
    if (!req.file) return res.status(400).json({ error: "Pakia faili la Excel." });
    try {
        const examStatus = await pool.query('SELECT is_locked FROM exams WHERE id = $1', [exam_id]);
        if (examStatus.rows.length > 0 && examStatus.rows[0].is_locked) return res.status(403).json({ error: "Matokeo yamefungwa." });
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        if (data.length === 0) return res.status(400).json({ error: "Faili ni tupu." });
        const subjectsRes = await pool.query(`SELECT id, name FROM subjects WHERE school_id = $1`, [user.school_id]);
        const subjectMap = {}; subjectsRes.rows.forEach(s => subjectMap[s.name.toLowerCase()] = s.id);
        let successCount = 0; let errors = [];
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (let row of data) {
                const studentName = row['Jina la Mwanafunzi'] ? row['Jina la Mwanafunzi'].trim() : null;
                const gender = row['Jinsia'] ? row['Jinsia'].trim().toUpperCase() : 'M';
                if (!studentName || studentName === 'Mfano: John Doe') continue; 
                const studentRes = await client.query(`SELECT id FROM students WHERE LOWER(full_name) = LOWER($1) AND gender = $2 AND stream_id = $3 AND school_id = $4`, [studentName, gender, stream_id, user.school_id]);
                if (studentRes.rows.length === 0) { errors.push(`"${studentName}" hajapatikana.`); continue; }
                const studentId = studentRes.rows[0].id;
                for (let subjectName in row) {
                    const subNameLower = subjectName.toLowerCase();
                    if (subjectMap[subNameLower]) {
                        const subjectId = subjectMap[subNameLower];
                        let score = parseFloat(row[subjectName]);
                        if (!isNaN(score)) {
                            if (score < 0) score = 0; if (score > 100) score = 100;
                            await client.query('DELETE FROM results WHERE student_id = $1 AND exam_id = $2 AND subject_id = $3', [studentId, exam_id, subjectId]);
                            await client.query('INSERT INTO results (student_id, exam_id, subject_id, score, school_id) VALUES ($1, $2, $3, $4, $5)', [studentId, exam_id, subjectId, score, user.school_id]);
                        }
                    }
                }
                successCount++;
            }
            await client.query('COMMIT');
            res.json({ message: `Imefanikiwa kupakia alama za ${successCount} wanafunzi.`, errors: errors.length > 0 ? errors : null });
        } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    } catch (error) { res.status(500).json({ error: `Imeshindikana: ${error.message}` }); }
});

// 10. RIPOTI ZINGINE (BROADSHEET NA EXPORT)
app.get('/api/reports/export-excel/:exam_id', authenticateToken, async (req, res) => {
    const { exam_id } = req.params; const user = req.user;
    if (user.role !== 'mtaaluma_mkuu' && user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa." });
    try {
        const query = `SELECT s.full_name as "Jina la Mwanafunzi", s.admission_number as "Namba ya Usajili", st.name as "Darasa", sub.name as "Somo", r.score as "Alama" FROM results r JOIN students s ON r.student_id = s.id LEFT JOIN streams st ON s.stream_id = st.id JOIN subjects sub ON r.subject_id = sub.id WHERE r.exam_id = $1 AND r.school_id = $2 ORDER BY s.full_name ASC, sub.name ASC`;
        const result = await pool.query(query, [exam_id, user.school_id]);
        const ws = xlsx.utils.json_to_sheet(result.rows);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, "Alama_Zote");
        const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', `attachment; filename="Alama_Mtihani_${exam_id}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/reports/broadsheet', authenticateToken, async (req, res) => {
    const { exam_id, stream_id } = req.query; const user = req.user;
    if (!exam_id || !stream_id) return res.status(400).json({ error: "Chagua" });
    if (!user.school_id) return res.status(400).json({ error: "Hana shule" });
    try {
        const studentsRes = await pool.query(`SELECT id, full_name, gender FROM students WHERE stream_id = $1 AND school_id = $2 ORDER BY full_name ASC`, [stream_id, user.school_id]);
        const subjectsRes = await pool.query(`SELECT DISTINCT sub.id, sub.name FROM subjects sub JOIN results r ON sub.id = r.subject_id JOIN students s ON r.student_id = s.id WHERE r.exam_id = $1 AND s.stream_id = $2 AND r.school_id = $3 ORDER BY sub.name ASC`, [exam_id, stream_id, user.school_id]);
        const subjects = subjectsRes.rows;
        const resultsRes = await pool.query(`SELECT r.student_id, r.subject_id, r.score FROM results r JOIN students s ON r.student_id = s.id WHERE r.exam_id = $1 AND s.stream_id = $2 AND r.school_id = $3`, [exam_id, stream_id, user.school_id]);
        const results = resultsRes.rows;
        const reportData = studentsRes.rows.map(student => {
            let totalScore = 0, subjectsCount = 0, totalPoints = 0; 
            const scores = {};
            subjects.forEach(sub => {
                const result = results.find(r => r.student_id === student.id && r.subject_id === sub.id);
                if (result) { 
                    const score = parseFloat(result.score);
                    const { grade, points } = getGradeAndPoints(score);
                    scores[sub.id] = { score: score, grade: grade }; 
                    totalScore += score; 
                    totalPoints += points;
                    subjectsCount++; 
                } else { scores[sub.id] = { score: null, grade: 'X' }; }
            });
            return { student_id: student.id, full_name: student.full_name, gender: student.gender, scores, total: totalScore, points: totalPoints, division: getDivision(totalPoints), average: subjectsCount > 0 ? parseFloat((totalScore / subjectsCount).toFixed(2)) : 0 };
        });
        reportData.sort((a, b) => b.average - a.average);
        let currentPosition = 1;
        for (let i = 0; i < reportData.length; i++) { if (i > 0 && reportData[i].average < reportData[i-1].average) { currentPosition = i + 1; } reportData[i].position = currentPosition; }
        const streamRes = await pool.query('SELECT name FROM streams WHERE id = $1', [stream_id]);
        const streamName = streamRes.rows.length > 0 ? streamRes.rows[0].name : 'Stream';
        const examRes = await pool.query('SELECT is_locked FROM exams WHERE id = $1', [exam_id]);
        const is_locked = examRes.rows.length > 0 ? examRes.rows[0].is_locked : false;
        res.json({ subjects, reportData, streamName, is_locked });
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
        let totalScore = 0, subjectsCount = 0, totalPoints = 0, countDOrBetter = 0;
        const scores = subjectsRes.rows.map(sub => {
            const result = resultsRes.rows.find(r => r.subject_id === sub.id);
            let score = '-', grade = '-', points = 0;
            if (result) { 
                score = parseFloat(result.score); totalScore += score; 
                const g = getGradeAndPoints(score); grade = g.grade; points = g.points; totalPoints += points;
                if (['A', 'B', 'C', 'D'].includes(grade)) countDOrBetter++;
                subjectsCount++; 
            }
            return { name: sub.name, score: score, grade: grade, points: points };
        });
        const average = subjectsCount > 0 ? (totalScore / subjectsCount).toFixed(2) : 0;
        const division = getDivision(totalPoints);
        let status = 'INC';
        if (totalPoints <= 7 && countDOrBetter >= 2) { status = 'PASS'; }
        const classResultsRes = await pool.query(`SELECT r.student_id, SUM(r.score) as total FROM results r JOIN students s ON r.student_id = s.id WHERE s.stream_id = $1 AND r.exam_id = $2 AND r.school_id = $3 GROUP BY r.student_id ORDER BY total DESC`, [student.stream_id, exam_id, user.school_id]);
        let position = '-', totalInClass = classResultsRes.rows.length;
        if (totalInClass > 0) { const rank = classResultsRes.rows.findIndex(r => r.student_id == student_id); position = rank !== -1 ? rank + 1 : '-'; }
        const schoolRes = await pool.query(`SELECT name FROM schools WHERE id = $1`, [user.school_id]);
        const schoolName = schoolRes.rows.length > 0 ? schoolRes.rows[0].name : 'Shule';
        res.json({ schoolName, student, streamName, scores, total: totalScore, totalPoints, division, status, average: parseFloat(average), position, totalInClass });
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

// 11. SHULE NA WATUMIAJI
app.get('/api/schools', authenticateToken, async (req, res) => {
    try { const result = await pool.query('SELECT * FROM schools ORDER BY name ASC'); res.json(result.rows); } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
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
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: "Hauna ruhusa" });
    try { const result = await pool.query(`SELECT u.id, u.full_name, u.username, u.role, u.school_id, s.name as school_name FROM users u LEFT JOIN schools s ON u.school_id = s.id ORDER BY u.id DESC`); res.json(result.rows); } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

// 12. KINGA YA API NA MWISHO
app.use('/api', (req, res) => { res.status(404).json({ error: "API uliyoitafuta haipo kwenye mfumo" }); });
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));