const express = require('express');
const router = express.Router();
const pool = require('../db'); // Hakikisha path hii inaelekeza kwenye db yako
const authenticateToken = require('../middleware/auth'); // Middleware yako ya JWT

router.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        let targetSchoolId;

        // 1. ULINZI WA BACKEND (RBAC)
        if (user.role === 'super_admin') {
            // Super admin anatumia id aliyoichagua kwenye dropdown, kama hajachagua anatumia yake
            targetSchoolId = req.query.school_id || user.school_id;
        } else if (user.role === 'school_manager') {
            // Mkuu wa shule LAZIMA atumie ID yake mwenyewe, hata akituma nyingine kwenye URL inapuuzwa!
            targetSchoolId = user.school_id;
        } else {
            return res.status(403).json({ error: "Hauna ruhusa kuona takwimu hizi" });
        }

        if (!targetSchoolId) {
            return res.json({ totalStudents: 0, totalTeachers: 0, totalClasses: 0, totalFees: 0 });
        }

        // 2. QUERIES ZA DATA
        const studentsQuery = `SELECT COUNT(*) FROM students WHERE school_id = $1`;
        const teachersQuery = `SELECT COUNT(*) FROM teachers WHERE school_id = $1`;
        const classesQuery = `SELECT COUNT(*) FROM classes WHERE school_id = $1`;
        
        // Chukulia table ya malipo inaitwa 'payments'
        const feesQuery = `SELECT COALESCE(SUM(amount_paid), 0) as total FROM payments WHERE school_id = $1`;

        const [studentsRes, teachersRes, classesRes, feesRes] = await Promise.all([
            pool.query(studentsQuery, [targetSchoolId]),
            pool.query(teachersQuery, [targetSchoolId]),
            pool.query(classesQuery, [targetSchoolId]),
            pool.query(feesQuery, [targetSchoolId])
        ]);

        // 3. MAJIBU
        res.json({
            totalStudents: parseInt(studentsRes.rows[0].count),
            totalTeachers: parseInt(teachersRes.rows[0].count),
            totalClasses: parseInt(classesRes.rows[0].count),
            totalFees: parseFloat(feesRes.rows[0].total),
            school_name: user.role === 'school_manager' ? "NYANG'HOMANGO SECONDARY SCHOOL" : "Shule Iliyochaguliwa" // Unaweza kuileta kutoka DB
        });

    } catch (error) {
        console.error("Kosa Dashboard API:", error);
        res.status(500).json({ error: "Imeshindikana kupata takwimu" });
    }
});

module.exports = router;