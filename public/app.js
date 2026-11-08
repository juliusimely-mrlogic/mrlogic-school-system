const API_BASE = 'http://localhost:3000/api';
let token = localStorage.getItem('token');
let currentSchoolId = null;
let allClasses = [];
let allStudents = [];
let allSubjects = [];
let allExams = [];
let allFees = []; 
let allTeachers = []; 
let allAssignments = []; 

const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const welcomeMsg = document.getElementById('welcome-msg');
const schoolSelector = document.getElementById('school-selector');
const teachersSection = document.getElementById('teachers-section');
const studentsSection = document.getElementById('students-section');
const classesSection = document.getElementById('classes-section');
const feesSection = document.getElementById('fees-section');
const attendanceSection = document.getElementById('attendance-section');
const examsSection = document.getElementById('exams-section');
const notificationsSection = document.getElementById('notifications-section'); // MPYA
const analyticsSection = document.getElementById('analytics-section');

if (token) { showDashboard(); }

// 1. Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    document.getElementById('login-btn').innerText = 'Inaingia...';
    loginError.innerText = '';

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user_name', data.user.full_name);
            token = data.token;
            showDashboard();
        } else {
            loginError.innerText = data.error || 'Kuingia kimeshindikana.';
        }
    } catch (err) {
        loginError.innerText = 'Server haipatikani.';
    } finally {
        document.getElementById('login-btn').innerText = 'Ingia Mfumoni';
    }
});

// 2. Logout
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_name');
    loginScreen.style.display = 'flex';
    dashboardScreen.style.display = 'none';
    loginForm.reset();
});

// 3. Dashboard
async function showDashboard() {
    welcomeMsg.innerText = `Karibu, ${localStorage.getItem('user_name') || 'Mtumiaji'}!`;
    loginScreen.style.display = 'none';
    dashboardScreen.style.display = 'block';
    document.getElementById('att-date').value = new Date().toISOString().split('T')[0];
    await loadSchools();
}

// 4. Kuvuta Shule
async function loadSchools() {
    try {
        const res = await fetch(`${API_BASE}/schools`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        
        if (res.ok && data.schools) {
            schoolSelector.innerHTML = '<option value="">-- Chagua Shule --</option>';
            if (data.schools.length === 0) {
                schoolSelector.innerHTML += `<option value="">Hakuna shule. Bonyeza "+ Sajili Shule Mpya"</option>`;
            } else {
                data.schools.forEach(school => {
                    schoolSelector.innerHTML += `<option value="${school.id}">${school.name}</option>`;
                });
            }
        } else {
            alert("Kosa la kupata shule: " + (data.error || 'Token imeisha muda, toka (logout) na uingie tena.'));
        }
    } catch (err) { 
        console.error(err); 
        alert("Server haipatikani. Hakikisha node server.js inafanya kazi.");
    }
}

// 5. Toggle School Form
function toggleSchoolForm() {
    const container = document.getElementById('school-form-container');
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
}

// 6. Sajili Shule
document.getElementById('school-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('school-code').value;
    const name = document.getElementById('school-name').value;
    const region = document.getElementById('school-region').value;
    const district = document.getElementById('school-district').value;

    try {
        const res = await fetch(`${API_BASE}/schools`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ code, name, region, district, schoolLevels: ['O_LEVEL'], languages: ['sw'] })
        });
        if (res.ok) {
            alert("Shule imesajiliwa!");
            document.getElementById('school-form').reset();
            toggleSchoolForm();
            await loadSchools();
        } else {
            const data = await res.json();
            alert("Kosa: " + data.error);
        }
    } catch (err) { alert("Hitilafu ya mtandao"); }
});

// 7. Mabadiliko ya Kichaguzi cha Shule
schoolSelector.addEventListener('change', async (e) => {
    currentSchoolId = e.target.value;
    if (currentSchoolId) {
        analyticsSection.style.display = 'block';
        await loadClasses();
        await loadStudents();
        await loadTeachers(); 
        await loadSubjects();
        await loadFees();
        await loadExams();
        await loadAssignments();
        await loadNotifications(); // MPYA
        updateDashboardStats();
    } else {
        analyticsSection.style.display = 'none';
        document.getElementById('students-table-body').innerHTML = '';
        document.getElementById('teachers-table-body').innerHTML = '';
        document.getElementById('classes-table-body').innerHTML = '';
        document.getElementById('fees-table-body').innerHTML = '';
        document.getElementById('assignments-table-body').innerHTML = '';
        document.getElementById('notifications-list').innerHTML = '';
        document.getElementById('student-class').innerHTML = '<option value="">-- Chagua Darasa --</option>';
        document.getElementById('att-class').innerHTML = '<option value="">-- Chagua Darasa --</option>';
        document.getElementById('exam-class').innerHTML = '<option value="">-- Chagua Darasa --</option>';
        document.getElementById('assign-class').innerHTML = '<option value="">-- Chagua Darasa --</option>';
        document.getElementById('assign-subject').innerHTML = '<option value="">-- Chagua Somo --</option>';
        document.getElementById('assign-teacher').innerHTML = '<option value="">-- Chagua Mwalimu --</option>';
    }
});

// 8. KUSASISHA TAKWIMU ZA DASHIBODI
function updateDashboardStats() {
    document.getElementById('stat-students').innerText = allStudents.length;
    document.getElementById('stat-teachers').innerText = allTeachers.length; 
    document.getElementById('stat-classes').innerText = allClasses.length;
    document.getElementById('stat-exams').innerText = allExams.length;
    
    const totalFees = allFees.reduce((sum, fee) => sum + fee.amount, 0);
    document.getElementById('stat-fees').innerText = 'Tsh ' + totalFees.toLocaleString();
}

// 9. KUVUTA NA KUTUMA TAARIFA (NOTIFICATIONS)
async function loadNotifications() {
    if (!currentSchoolId) return;
    try {
        const res = await fetch(`${API_BASE}/notifications?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        
        const list = document.getElementById('notifications-list');
        list.innerHTML = '';
        
        if (data.notifications && data.notifications.length > 0) {
            data.notifications.forEach(n => {
                const date = new Date(n.created_at).toLocaleString('sw-TZ');
                list.innerHTML += `
                    <div style="background: white; padding: 15px; border-left: 5px solid #3498db; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <h4 style="color: #2c3e50; margin-bottom: 5px;">${n.title}</h4>
                        <p style="color: #555; margin-bottom: 10px;">${n.message}</p>
                        <small style="color: #999;"><i class="fas fa-clock"></i> ${date}</small>
                    </div>
                `;
            });
        } else {
            list.innerHTML = '<p style="text-align: center; color: #777;">Hakuna taarifa yoyote kwa sasa.</p>';
        }
    } catch (err) { console.error(err); }
}

document.getElementById('notification-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentSchoolId) return alert("Tafadhali chagua shule kwanza!");

    const title = document.getElementById('notif-title').value;
    const message = document.getElementById('notif-message').value;

    try {
        const res = await fetch(`${API_BASE}/notifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ school_id: currentSchoolId, title, message })
        });
        if (res.ok) {
            alert("Taarifa imetumwa kikamilifu!");
            document.getElementById('notification-form').reset();
            await loadNotifications();
        } else {
            const data = await res.json();
            alert("Kosa: " + data.error);
        }
    } catch (err) { alert("Hitilafu ya mtandao"); }
});

// 10. KUVUTA NA KUSAJILI WALIMU
async function loadTeachers() {
    if (!currentSchoolId) return;
    try {
        const res = await fetch(`${API_BASE}/teachers?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        allTeachers = data.teachers || [];
        
        const tbody = document.getElementById('teachers-table-body');
        tbody.innerHTML = '';
        
        if (allTeachers.length > 0) {
            allTeachers.forEach((t, index) => {
                tbody.innerHTML += `<tr>
                    <td>${index + 1}</td>
                    <td>${t.full_name}</td>
                    <td>${t.phone || '-'}</td>
                    <td>${t.gender || '-'}</td>
                </tr>`;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Hakuna walimu.</td></tr>';
        }

        const assignTeacherDropdown = document.getElementById('assign-teacher');
        assignTeacherDropdown.innerHTML = '<option value="">-- Chagua Mwalimu --</option>';
        allTeachers.forEach(t => {
            assignTeacherDropdown.innerHTML += `<option value="${t.id}">${t.full_name}</option>`;
        });

    } catch (err) { console.error(err); }
}

document.getElementById('teacher-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentSchoolId) return alert("Tafadhali chagua shule kwanza!");

    const full_name = document.getElementById('teacher-name').value;
    const phone = document.getElementById('teacher-phone').value;
    const gender = document.getElementById('teacher-gender').value;

    try {
        const res = await fetch(`${API_BASE}/teachers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ school_id: currentSchoolId, full_name, phone, gender })
        });
        if (res.ok) {
            alert("Mwalimu amesajiliwa!");
            document.getElementById('teacher-form').reset();
            await loadTeachers();
            updateDashboardStats(); 
        } else {
            const errorData = await res.json();
            alert("Kosa: " + errorData.error);
        }
    } catch (err) { alert("Hitilafu ya mtandao"); }
});

// 11. KUVUTA NA KUSAJILI MGAWANYO WA KAZI
async function loadAssignments() {
    if (!currentSchoolId) return;
    try {
        const res = await fetch(`${API_BASE}/teachers/assignments?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        allAssignments = data.assignments || [];
        
        const tbody = document.getElementById('assignments-table-body');
        tbody.innerHTML = '';
        
        if (allAssignments.length > 0) {
            allAssignments.forEach((a, index) => {
                tbody.innerHTML += `<tr>
                    <td>${index + 1}</td>
                    <td>${a.teacher_name}</td>
                    <td>${a.class_name}</td>
                    <td>${a.subject_name}</td>
                </tr>`;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Hakuna mgawanyo wa kazi bado.</td></tr>';
        }
    } catch (err) { console.error(err); }
}

document.getElementById('assignment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentSchoolId) return alert("Tafadhali chagua shule kwanza!");

    const teacher_id = document.getElementById('assign-teacher').value;
    const class_id = document.getElementById('assign-class').value;
    const subject_id = document.getElementById('assign-subject').value;

    try {
        const res = await fetch(`${API_BASE}/teachers/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ school_id: currentSchoolId, teacher_id, class_id, subject_id })
        });
        if (res.ok) {
            alert("Mgawanyo umefanikiwa!");
            document.getElementById('assignment-form').reset();
            await loadAssignments();
        } else {
            const errorData = await res.json();
            alert("Kosa: " + errorData.error);
        }
    } catch (err) { alert("Hitilafu ya mtandao"); }
});

// 12. Kuvuta Madarasa
async function loadClasses() {
    if (!currentSchoolId) return;
    try {
        const res = await fetch(`${API_BASE}/classes?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        allClasses = data.classes || [];
        
        const classDropdown = document.getElementById('student-class');
        const attClassDropdown = document.getElementById('att-class');
        const examClassDropdown = document.getElementById('exam-class');
        const assignClassDropdown = document.getElementById('assign-class'); 
        
        classDropdown.innerHTML = '<option value="">-- Chagua Darasa --</option>';
        attClassDropdown.innerHTML = '<option value="">-- Chagua Darasa --</option>';
        examClassDropdown.innerHTML = '<option value="">-- Chagua Darasa --</option>';
        assignClassDropdown.innerHTML = '<option value="">-- Chagua Darasa --</option>'; 

        allClasses.forEach(c => {
            classDropdown.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            attClassDropdown.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            examClassDropdown.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            assignClassDropdown.innerHTML += `<option value="${c.id}">${c.name}</option>`; 
        });

        const tbody = document.getElementById('classes-table-body');
        tbody.innerHTML = '';
        if (allClasses.length > 0) {
            allClasses.forEach((c, index) => {
                tbody.innerHTML += `<tr>
                    <td>${index + 1}</td>
                    <td>${c.name}</td>
                    <td>${c.level_type}</td>
                </tr>`;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Hakuna madarasa.</td></tr>';
        }
    } catch (err) { console.error(err); }
}

// 13. Sajili Darasa
document.getElementById('class-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentSchoolId) return alert("Tafadhali chagua shule kwanza!");

    const name = document.getElementById('class-name').value;
    const level_type = document.getElementById('class-level').value;

    try {
        const res = await fetch(`${API_BASE}/classes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ school_id: currentSchoolId, name, level_type })
        });
        if (res.ok) {
            alert("Darasa limesajiliwa!");
            document.getElementById('class-form').reset();
            await loadClasses();
            updateDashboardStats(); 
        } else {
            const errorData = await res.json();
            alert("Kosa: " + errorData.error);
        }
    } catch (err) { alert("Hitilafu ya mtandao"); }
});

// 14. Kuvuta Wanafunzi
async function loadStudents() {
    if (!currentSchoolId) return;
    try {
        const res = await fetch(`${API_BASE}/students?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        allStudents = data.students || [];
        
        const tbody = document.getElementById('students-table-body');
        tbody.innerHTML = '';
        
        if (allStudents.length > 0) {
            allStudents.forEach((s, index) => {
                const className = allClasses.find(c => c.id === s.class_id)?.name || 'Hakuna';
                tbody.innerHTML += `<tr>
                    <td>${index + 1}</td>
                    <td>${s.full_name}</td>
                    <td>${s.gender}</td>
                    <td>${className}</td>
                    <td>${s.parent_phone || '-'}</td>
                </tr>`;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Hakuna wanafunzi.</td></tr>';
        }

        const feeStudentDropdown = document.getElementById('fee-student');
        const marksStudentDropdown = document.getElementById('marks-student');
        const printReportStudentDropdown = document.getElementById('print-report-student'); 
        
        feeStudentDropdown.innerHTML = '<option value="">-- Chagua Mwanafunzi --</option>';
        marksStudentDropdown.innerHTML = '<option value="">-- Chagua Mwanafunzi --</option>';
        printReportStudentDropdown.innerHTML = '<option value="">-- Chagua Mwanafunzi --</option>'; 
        
        allStudents.forEach(s => {
            feeStudentDropdown.innerHTML += `<option value="${s.id}">${s.full_name} (${s.admission_number})</option>`;
            marksStudentDropdown.innerHTML += `<option value="${s.id}">${s.full_name}</option>`;
            printReportStudentDropdown.innerHTML += `<option value="${s.id}">${s.full_name}</option>`; 
        });

    } catch (err) { console.error(err); }
}

// 15. Sajili Mwanafunzi (Sasa na Namba ya Mzazi)
document.getElementById('student-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentSchoolId) return alert("Tafadhali chagua shule kwanza!");

    const full_name = document.getElementById('student-name').value;
    const gender = document.getElementById('student-gender').value;
    const admission_number = document.getElementById('student-adm').value;
    const parent_phone = document.getElementById('student-parent-phone').value;
    const class_id = document.getElementById('student-class').value;

    try {
        const res = await fetch(`${API_BASE}/students`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ school_id: currentSchoolId, class_id, full_name, gender, admission_number, parent_phone })
        });
        if (res.ok) {
            alert("Mwanafunzi amesajiliwa!");
            document.getElementById('student-form').reset();
            await loadStudents();
            updateDashboardStats(); 
        } else {
            const errorData = await res.json();
            alert("Kosa: " + errorData.error);
        }
    } catch (err) { alert("Hitilafu ya mtandao"); }
});

// 16. Kuvuta Malipo
async function loadFees() {
    if (!currentSchoolId) return;
    try {
        const res = await fetch(`${API_BASE}/fees/school/${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        
        allFees = data.fees || []; 
        const tbody = document.getElementById('fees-table-body');
        tbody.innerHTML = '';
        
        if (allFees.length > 0) {
            allFees.forEach((f, index) => {
                tbody.innerHTML += `<tr>
                    <td>${index + 1}</td>
                    <td>${f.full_name}</td>
                    <td>Tsh ${f.amount.toLocaleString()}</td>
                    <td>${f.term}</td>
                    <td>${f.year}</td>
                    <td>
                        <button onclick="printReceipt(${f.id})" class="btn-blue" style="padding: 5px 10px; font-size: 12px;">Chapisha</button>
                    </td>
                </tr>`;
            });
            document.getElementById('total-fees-display').innerText = data.total_collected.toLocaleString();
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Hakuna malipo yaliyorekodiwa.</td></tr>';
            document.getElementById('total-fees-display').innerText = '0';
        }
    } catch (err) { console.error(err); }
}

// 17. Rekodi Malipo
document.getElementById('fee-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentSchoolId) return alert("Tafadhali chagua shule kwanza!");

    const student_id = document.getElementById('fee-student').value;
    const amount = parseFloat(document.getElementById('fee-amount').value);
    const term = document.getElementById('fee-term').value;
    const year = parseInt(document.getElementById('fee-year').value);

    try {
        const res = await fetch(`${API_BASE}/fees`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ school_id: currentSchoolId, student_id, amount, term, year })
        });
        if (res.ok) {
            alert("Malipo yamerekodiwa!");
            document.getElementById('fee-form').reset();
            await loadFees();
            await loadNotifications(); // Sasisha taarifa mara moja
            updateDashboardStats(); 
        } else {
            const errorData = await res.json();
            alert("Kosa: " + errorData.error);
        }
    } catch (err) { alert("Hitilafu ya mtandao"); }
});

// 18. Kuchapisha Risiti
function printReceipt(feeId) {
    const fee = allFees.find(f => f.id === feeId);
    if (!fee) return;

    const schoolName = schoolSelector.options[schoolSelector.selectedIndex].text;
    const dateStr = new Date(fee.date_paid).toLocaleDateString('sw-TZ', { year: 'numeric', month: 'long', day: 'numeric' });

    const receiptHTML = `
        <div class="receipt-header">
            <h2>${schoolName}</h2>
            <h4>RISITI YA MALIPO</h4>
        </div>
        <div class="receipt-body">
            <p><strong>Namba ya Risiti:</strong> RCPT-${fee.id}-${fee.year}</p>
            <p><strong>Tarehe:</strong> ${dateStr}</p>
            <p><strong>Jina la Mwanafunzi:</strong> ${fee.full_name}</p>
            <p><strong>Muhula:</strong> ${fee.term} (${fee.year})</p>
            <p><strong>Kiasi Kilicholipwa:</strong> <span style="font-size: 22px; font-weight: bold;">Tsh ${fee.amount.toLocaleString()}</span></p>
        </div>
        <div class="receipt-footer">
            <div><p>Sahihi ya Mzazi: ......................</p></div>
            <div><p>Sahihi ya Mpokeaji: ......................</p></div>
        </div>
        <div style="text-align: center; margin-top: 40px; font-size: 12px; color: #555;">
            <p>Asante kwa kulipa. Risiti hii ni uthibitisho wa malipo.</p>
            <p>Imepakuliwa kupitia MR-LOGIC System.</p>
        </div>
    `;

    document.getElementById('printable-area').innerHTML = receiptHTML;
    window.print();
}

// 19. KUCHAPISHA RIPOTI YA MATOKEO
async function generateReportCard() {
    const examId = document.getElementById('print-report-exam').value;
    const studentId = document.getElementById('print-report-student').value;

    if (!examId || !studentId) return alert("Tafadhali chagua mtihani na mwanafunzi!");

    try {
        const res = await fetch(`${API_BASE}/exams/results?exam_id=${examId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        
        const allResults = data.results || [];
        const studentResults = allResults.filter(r => r.student_id == studentId);

        if (studentResults.length === 0) {
            return alert("Hakuna alama zilizorekodiwa kwa mwanafunzi huyu kwenye mtihani huu.");
        }

        const student = allStudents.find(s => s.id == studentId);
        const exam = allExams.find(e => e.id == examId);
        const schoolName = schoolSelector.options[schoolSelector.selectedIndex].text;

        let totalMarks = 0;
        let subjectRows = "";
        studentResults.forEach((r, index) => {
            totalMarks += r.marks;
            subjectRows += `<tr>
                <td style="padding: 8px; text-align: center;">${index + 1}</td>
                <td style="padding: 8px;">${r.subject_name}</td>
                <td style="padding: 8px; text-align: center; font-weight: bold;">${r.marks}</td>
            </tr>`;
        });

        const average = (totalMarks / studentResults.length).toFixed(2);
        let grade = "F";
        if (average >= 75) grade = "A";
        else if (average >= 65) grade = "B";
        else if (average >= 45) grade = "C";
        else if (average >= 30) grade = "D";

        const reportHTML = `
            <div class="receipt-header">
                <h2>${schoolName}</h2>
                <h4>RIPOTI YA MATOKEO YA MTIHANI</h4>
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 16px;">
                <div>
                    <p><strong>Jina la Mwanafunzi:</strong> ${student.full_name}</p>
                    <p><strong>Namba ya Usajili:</strong> ${student.admission_number}</p>
                </div>
                <div>
                    <p><strong>Mtihani:</strong> ${exam.name}</p>
                    <p><strong>Muhula/Mwaka:</strong> ${exam.term} / ${exam.year}</p>
                </div>
            </div>
            
            <table class="report-table" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr>
                        <th style="padding: 8px; text-align: center; width: 50px;">Namba</th>
                        <th style="padding: 8px;">Somo</th>
                        <th style="padding: 8px; text-align: center; width: 100px;">Alama</th>
                    </tr>
                </thead>
                <tbody>
                    ${subjectRows}
                </tbody>
            </table>

            <div style="border: 2px solid #000; padding: 15px; margin-bottom: 30px; background: #f9f9f9;">
                <p style="font-size: 16px; margin-bottom: 5px;"><strong>Jumla ya Alama:</strong> ${totalMarks}</p>
                <p style="font-size: 16px; margin-bottom: 5px;"><strong>Wastani (Average):</strong> ${average}</p>
                <p style="font-size: 16px;"><strong>Daraja (Grade):</strong> ${grade}</p>
            </div>

            <div class="receipt-footer" style="display: flex; justify-content: space-between; margin-top: 50px;">
                <div><p>Sahihi ya Mwalimu wa Darasa: ......................</p></div>
                <div><p>Sahihi ya Mkuu wa Shule: ......................</p></div>
            </div>
        `;

        document.getElementById('printable-area').innerHTML = reportHTML;
        window.print();

    } catch (err) {
        console.error(err);
        alert("Hitilafu wakati wa kutengeneza ripoti.");
    }
}

// 20. MAHUDHURIO: Kuvuta Wanafunzi
document.getElementById('load-att-btn').addEventListener('click', async () => {
    const class_id = document.getElementById('att-class').value;
    const date = document.getElementById('att-date').value;

    if (!currentSchoolId || !class_id || !date) return alert("Chagua shule, darasa, na tarehe!");

    try {
        const res = await fetch(`${API_BASE}/students?school_id=${currentSchoolId}&class_id=${class_id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        const students = data.students || [];
        const tbody = document.getElementById('attendance-table-body');
        tbody.innerHTML = '';
        const form = document.getElementById('attendance-form');

        if (students.length > 0) {
            students.forEach((s, index) => {
                tbody.innerHTML += `<tr>
                    <td>${index + 1}</td>
                    <td>${s.full_name}</td>
                    <td>
                        <select class="att-status" data-student-id="${s.id}">
                            <option value="PRESENT">Yupo (Present)</option>
                            <option value="ABSENT">Hayupo (Absent)</option>
                        </select>
                    </td>
                </tr>`;
            });
            form.style.display = 'block';
        } else {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Hakuna wanafunzi.</td></tr>';
            form.style.display = 'none';
        }
    } catch (err) { alert("Imeshindwa kuvuta wanafunzi."); }
});

// 21. MAHUDHURIO: Hifadhi
document.getElementById('attendance-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const class_id = document.getElementById('att-class').value;
    const date = document.getElementById('att-date').value;
    const selects = document.querySelectorAll('.att-status');
    const records = [];
    
    selects.forEach(select => {
        records.push({ student_id: parseInt(select.getAttribute('data-student-id')), status: select.value });
    });

    try {
        const res = await fetch(`${API_BASE}/attendance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ school_id: currentSchoolId, class_id, date, records })
        });
        if (res.ok) alert(`Mahudhurio ya tarehe ${date} yamehifadhiwa!`);
        else { const err = await res.json(); alert("Kosa: " + err.error); }
    } catch (err) { alert("Hitilafu ya mtandao."); }
});

// 22. MITIHANI: Kuvuta Masomo
async function loadSubjects() {
    if (!currentSchoolId) return;
    try {
        const res = await fetch(`${API_BASE}/academics/subjects?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        allSubjects = data.subjects || [];
        
        const subjectDropdown = document.getElementById('marks-subject');
        subjectDropdown.innerHTML = '<option value="">-- Chagua Somo --</option>';
        
        const assignSubjectDropdown = document.getElementById('assign-subject'); 
        assignSubjectDropdown.innerHTML = '<option value="">-- Chagua Somo --</option>'; 

        allSubjects.forEach(s => {
            subjectDropdown.innerHTML += `<option value="${s.id}">${s.name}</option>`;
            assignSubjectDropdown.innerHTML += `<option value="${s.id}">${s.name}</option>`; 
        });
    } catch (err) { console.error(err); }
}

// 23. MITIHANI: Kuvuta Mitihani Iliyopo
async function loadExams() {
    if (!currentSchoolId) return;
    try {
        const resAll = await fetch(`${API_BASE}/exams?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await resAll.json();
        
        allExams = data.exams || [];
        
        const examDropdownMarks = document.getElementById('marks-exam');
        const examDropdownView = document.getElementById('view-results-exam');
        const examDropdownPrint = document.getElementById('print-report-exam'); 
        
        examDropdownMarks.innerHTML = '<option value="">-- Chagua Mtihani --</option>';
        examDropdownView.innerHTML = '<option value="">-- Chagua Mtihani Kuona Matokeo --</option>';
        examDropdownPrint.innerHTML = '<option value="">-- Chagua Mtihani --</option>'; 
        
        allExams.forEach(e => {
            const label = `${e.name} (${e.term} ${e.year})`;
            examDropdownMarks.innerHTML += `<option value="${e.id}">${label}</option>`;
            examDropdownView.innerHTML += `<option value="${e.id}">${label}</option>`;
            examDropdownPrint.innerHTML += `<option value="${e.id}">${label}</option>`; 
        });
    } catch (err) { console.error(err); }
}

// 24. MITIHANI: Tengeneza Mtihani
document.getElementById('create-exam-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentSchoolId) return alert("Chagua shule kwanza!");

    const class_id = document.getElementById('exam-class').value;
    const name = document.getElementById('exam-name').value;
    const term = document.getElementById('exam-term').value;
    const year = parseInt(document.getElementById('exam-year').value);

    try {
        const res = await fetch(`${API_BASE}/exams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ school_id: currentSchoolId, class_id, name, term, year })
        });
        if (res.ok) {
            alert("Mtihani umetengenezwa!");
            document.getElementById('create-exam-form').reset();
            await loadExams();
            updateDashboardStats(); 
        } else {
            const err = await res.json(); alert("Kosa: " + err.error);
        }
    } catch (err) { alert("Hitilafu ya mtandao"); }
});

// 25. MITIHANI: Weka Alama
document.getElementById('add-marks-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const exam_id = document.getElementById('marks-exam').value;
    const student_id = document.getElementById('marks-student').value;
    const subject_id = document.getElementById('marks-subject').value;
    const marks = parseFloat(document.getElementById('marks-score').value);

    try {
        const res = await fetch(`${API_BASE}/exams/results`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ exam_id, student_id, subject_id, marks })
        });
        if (res.ok) {
            alert("Alama zimehifadhiwa!");
            document.getElementById('add-marks-form').reset();
            if (document.getElementById('view-results-exam').value === exam_id) {
                await loadResults(exam_id);
            }
        } else {
            const err = await res.json(); alert("Kosa: " + err.error);
        }
    } catch (err) { alert("Hitilafu ya mtandao"); }
});

// 26. MITIHANI: Ona Matokeo
document.getElementById('view-results-exam').addEventListener('change', async (e) => {
    const exam_id = e.target.value;
    if (exam_id) {
        await loadResults(exam_id);
    } else {
        document.getElementById('exam-results-table-body').innerHTML = '';
    }
});

async function loadResults(exam_id) {
    try {
        const res = await fetch(`${API_BASE}/exams/results?exam_id=${exam_id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        const results = data.results || [];
        
        const tbody = document.getElementById('exam-results-table-body');
        tbody.innerHTML = '';
        
        if (results.length > 0) {
            results.forEach((r, index) => {
                tbody.innerHTML += `<tr>
                    <td>${index + 1}</td>
                    <td>${r.student_name}</td>
                    <td>${r.subject_name}</td>
                    <td style="font-weight: bold; color: ${r.marks >= 50 ? 'green' : 'red'};">${r.marks}</td>
                </tr>`;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Hakuna matokeo bado.</td></tr>';
        }
    } catch (err) { console.error(err); }
}

// 27. Kubadilisha Sehemu
function showSection(section) {
    teachersSection.style.display = 'none';
    studentsSection.style.display = 'none';
    classesSection.style.display = 'none';
    feesSection.style.display = 'none';
    attendanceSection.style.display = 'none';
    examsSection.style.display = 'none';
    notificationsSection.style.display = 'none'; // MPYA
    
    if (section === 'students') {
        studentsSection.style.display = 'block';
        if (!currentSchoolId) alert("Tafadhali chagua shule juu kwanza ili kuona wanafunzi.");
    } else if (section === 'teachers') {
        teachersSection.style.display = 'block';
        if (!currentSchoolId) alert("Tafadhali chagua shule juu kwanza ili kuona walimu.");
    } else if (section === 'classes') {
        classesSection.style.display = 'block';
        if (!currentSchoolId) alert("Tafadhali chagua shule juu kwanza ili kuona madarasa.");
    } else if (section === 'fees') {
        feesSection.style.display = 'block';
        if (!currentSchoolId) alert("Tafadhali chagua shule juu kwanza ili kuona malipo.");
    } else if (section === 'attendance') {
        attendanceSection.style.display = 'block';
        if (!currentSchoolId) alert("Tafadhali chagua shule juu kwanza ili kuweka mahudhurio.");
    } else if (section === 'exams') {
        examsSection.style.display = 'block';
        if (!currentSchoolId) alert("Tafadhali chagua shule juu kwanza ili kuweka mitihani.");
    } else if (section === 'notifications') {
        notificationsSection.style.display = 'block'; // MPYA
        if (!currentSchoolId) alert("Tafadhali chagua shule juu kwanza ili kuona taarifa.");
    }
}