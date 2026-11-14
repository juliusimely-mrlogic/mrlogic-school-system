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

        const token = jwt.sign(
            { id: user.id, role: user.role, school_id: user.school_id, name: user.full_name },
            process.env.JWT_SECRET || 'siri_yako_ya_siri',
            { expiresIn: '1d' }
        );
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

    } catch (error) { 
        console.error("Failed Students Error:", error);
        res.status(500).json({ error: `Imeshindikana kuleta data: ${error.message}` }); 
    }
});

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

app.get('/api/teachers', authenticateToken, async (req, res) => {
    try {
        const user = req.user; let query = `SELECT * FROM teachers`; let params = [];
        if (user.role === 'super_admin') { if (req.query.school_id) { query += ` WHERE school_id = $1`; params.push(req.query.school_id); } } 
        else { if (!user.school_id) return res.status(400).json({ error: "Hana shule" }); query += ` WHERE school_id = $1`; params.push(user.school_id); }
        query += ` ORDER BY full_name ASC`; const result = await pool.query(query, params); res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.post('/api/teachers', authenticateToken, async (req, res) => {
    const { full_name, gender, phone, designation } = req.body; 
    const user = req.user;
    if (!user.school_id) return res.status(400).json({ error: "Hana shule" });
    
    const client = await pool.connect();
    try {
        let nameParts = full_name.trim().toLowerCase().split(/\s+/);
        let firstName = nameParts[0] || '';
        let lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
        let baseUsername = (firstName + lastName).replace(/[^a-z0-9]/g, '');
        if (!baseUsername) baseUsername = "teacher";
        
        let username = baseUsername;
        let counter = 1;
        
        let checkUser = await client.query('SELECT * FROM users WHERE username = $1', [username]);
        while (checkUser.rows.length > 0) {
            username = baseUsername + counter;
            counter++;
            checkUser = await client.query('SELECT * FROM users WHERE username = $1', [username]);
        }

        await client.query('BEGIN');
        const query = `INSERT INTO teachers (full_name, gender, phone, username, school_id, designation) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
        const result = await client.query(query, [full_name, gender, phone, username, user.school_id, designation || 'Mwalimu']);

        const salt = await bcrypt.genSalt(10); 
        const hashedPassword = await bcrypt.hash('password123', salt);
        
        await client.query(`INSERT INTO users (full_name, username, password_hash, role, school_id) VALUES ($1, $2, $3, $4, $5)`, 
            [full_name, username, hashedPassword, 'teacher', user.school_id]);

        await client.query('COMMIT');
        res.status(201).json({ ...result.rows[0], username });
    } catch (error) { 
        await client.query('ROLLBACK');
        res.status(500).json({ error: "Imeshindikana. Hakikisha column 'designation' ipo kwenye table ya teachers." }); 
    } finally {
        client.release();
    }
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

app.get('/api/streams', authenticateToken, async (req, res) => {
    try {
        const user = req.user; let query = `SELECT * FROM streams`; let params = [];
        if (user.role === 'super_admin') { if (req.query.school_id) { query += ` WHERE school_id = $1`; params.push(req.query.school_id); } } 
        else { if (!user.school_id) return res.status(400).json({ error: "Hana shule" }); query += ` WHERE school_id = $1`; params.push(user.school_id); }
        query += ` ORDER BY name ASC`; const result = await pool.query(query, params); res.json(result.rows);
    } catch (error) { res.status(500).json({ error: "Imeshindikana." }); }
});

app.get('/api/subjects', authenticateToken, async (req, res) => {
    try {
        const user = req.user; let query = `SELECT * FROM subjects`; let params = [];
        if (user.role === 'super_admin') { if (req.query.school_id) { query += ` WHERE school_id = $1`; params.push(req.query.school_id); } } 
        else { if (!user.school_id) return res.status(400).json({ error: "Hana shule" }); query += ` WHERE school_id = $1`; params.push(user.school_id); }
        query += ` ORDER BY name ASC`; const result = await pool.query(query, params); res.json(result.rows);
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

// ==========================================
// API MPYA: KUPATA TEMPLATE YA EXCEL (BLANK)
// ==========================================
app.get('/api/results/excel-template', async (req, res) => {
    // Kwa kuwa ni download link, tunapokea token kupitia query params
    const token = req.query.token;
    if (!token) return res.status(401).send("Hakuna token");

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'siri_yako_ya_siri');
        if (decoded.role !== 'mtaaluma' && decoded.role !== 'mtaaluma_mkuu' && decoded.role !== 'super_admin') {
            return res.status(403).send("Hauna ruhusa ya kupakua template hii.");
        }

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
    } catch (error) {
        res.status(500).send("Imeshindikana kutengeneza template.");
    }
});

// ==========================================
// API MPYA: KUPOKEA EXCEL YA ALAMA (UPLOAD)
// ==========================================
app.post('/api/results/upload-excel', authenticateToken, upload.single('file'), async (req, res) => {
    if (req.user.role !== 'mtaaluma' && req.user.role !== 'mtaaluma_mkuu' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: "Mtaaluma au Super Admin pekee anaruhusiwa kupakia alama." });
    }

    const { exam_id, stream_id } = req.body;
    const user = req.user;

    if (!exam_id || !stream_id) return res.status(400).json({ error: "Chagua Mtihani na Darasa kwanza." });
    if (!req.file) return res.status(400).json({ error: "Tafadhali pakia faili la Excel." });

    try {
        const examStatus = await pool.query('SELECT is_locked FROM exams WHERE id = $1', [exam_id]);
        if (examStatus.rows.length > 0 && examStatus.rows[0].is_locked) {
            return res.status(403).json({ error: "Matokeo yamefungwa. Huwezi kupakia mabadiliko." });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        
        if (data.length === 0) return res.status(400).json({ error: "Faili la Excel ni tupu." });

        const subjectsRes = await pool.query(`SELECT id, name FROM subjects WHERE school_id = $1`, [user.school_id]);
        const subjectMap = {}; 
        subjectsRes.rows.forEach(s => subjectMap[s.name.toLowerCase()] = s.id);

        let successCount = 0;
        let errors = [];
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            for (let row of data) {
                const studentName = row['Jina la Mwanafunzi'] ? row['Jina la Mwanafunzi'].trim() : null;
                const gender = row['Jinsia'] ? row['Jinsia'].trim().toUpperCase() : 'M';

                if (!studentName || studentName === 'Mfano: John Doe') {
                    continue; // Ruka safu ya mfano au tupu
                }

                const studentRes = await client.query(
                    `SELECT id FROM students WHERE LOWER(full_name) = LOWER($1) AND gender = $2 AND stream_id = $3 AND school_id = $4`,
                    [studentName, gender, stream_id, user.school_id]
                );

                if (studentRes.rows.length === 0) {
                    errors.push(`Mwanafunzi "${studentName}" hajapatikana kwenye darasa hili.`);
                    continue;
                }

                const studentId = studentRes.rows[0].id;

                for (let subjectName in row) {
                    const subNameLower = subjectName.toLowerCase();
                    if (subjectMap[subNameLower]) {
                        const subjectId = subjectMap[subNameLower];
                        let score = parseFloat(row[subjectName]);

                        if (!isNaN(score)) {
                            if (score < 0) score = 0;
                            if (score > 100) score = 100;

                            await client.query('DELETE FROM results WHERE student_id = $1 AND exam_id = $2 AND subject_id = $3', [studentId, exam_id, subjectId]);
                            await client.query(
                                'INSERT INTO results (student_id, exam_id, subject_id, score, school_id) VALUES ($1, $2, $3, $4, $5)',
                                [studentId, exam_id, subjectId, score, user.school_id]
                            );
                        }
                    }
                }
                successCount++;
            }

            await client.query('COMMIT');
            res.json({ 
                message: `Imefanikiwa kupakia alama za wanafunzi ${successCount}.`, 
                errors: errors.length > 0 ? errors : null 
            });

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error("Excel Upload Error:", error);
        res.status(500).json({ error: `Imeshindikana kupakia faili: ${error.message}` });
    }
});

app.use('/api', (req, res) => { res.status(404).json({ error: "API haipo" }); });
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));