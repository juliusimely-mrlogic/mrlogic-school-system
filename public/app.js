const API_BASE = '/api'; 
let token = localStorage.getItem('token');
let currentSchoolId = null;
let allClasses = [];
let allStudents = [];
let allSubjects = [];
let allExams = [];
let allFees = []; 
let allTeachers = []; 

if (token) { showDashboard(); }

// LOGIN
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    document.getElementById('login-btn').innerText = 'Inaingia...';
    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user_name', data.user.full_name);
            localStorage.setItem('user_role', data.user.role); // Hifadhi role
            token = data.token;
            showDashboard();
        } else { document.getElementById('login-error').innerText = data.error; }
    } catch (err) { document.getElementById('login-error').innerText = 'Server haipatikani.'; }
    finally { document.getElementById('login-btn').innerText = 'Ingia Mfumoni'; }
});

// LOGOUT
document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.clear(); location.reload();
});

// DASHBOARD
function showDashboard() {
    document.getElementById('welcome-msg').innerText = `Karibu, ${localStorage.getItem('user_name')}! (${localStorage.getItem('user_role')})`;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard-screen').style.display = 'block';
    loadSchools();
}

async function loadSchools() {
    const res = await fetch(`${API_BASE}/schools`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    if (data.schools) {
        const sel = document.getElementById('school-selector');
        sel.innerHTML = '<option value="">-- Chagua Shule --</option>';
        data.schools.forEach(s => sel.innerHTML += `<option value="${s.id}">${s.name}</option>`);
    }
}

function toggleSchoolForm() {
    const c = document.getElementById('school-form-container');
    c.style.display = c.style.display === 'none' ? 'block' : 'none';
}

// KUSAJILI SHULE MPYA (Inasoma zile sehemu zote mpya)
document.getElementById('school-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
        name: document.getElementById('school-name').value,
        code: document.getElementById('school-code').value,
        region: document.getElementById('school-region').value,
        district: document.getElementById('school-district').value,
        ward: document.getElementById('school-ward').value,
        exam_center_no: document.getElementById('school-exam-no').value,
        headmaster_name: document.getElementById('school-headmaster').value,
        ownership: document.getElementById('school-ownership').value,
        language: document.getElementById('school-language').value,
        schoolLevels: ['O_LEVEL', 'A_LEVEL', 'PRIMARY']
    };
    try {
        const res = await fetch(`${API_BASE}/schools`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        
        if (res.ok) {
            alert("Shule imesajiliwa kikamilifu!");
            document.getElementById('school-form').reset();
            toggleSchoolForm();
            loadSchools();
        } else {
            alert("KOSA: " + (data.error || 'Imeshindwa kusajili shule.'));
        }
    } catch (err) { alert("Hitilafu ya Mtandao."); }
});

// KUBADILISHA SHULE
document.getElementById('school-selector').addEventListener('change', async (e) => {
    currentSchoolId = e.target.value;
    if (currentSchoolId) {
        document.getElementById('analytics-section').style.display = 'block';
        await loadClasses();
        await loadSubjects(); 
        await loadStudents();
        await loadTeachers();
        await loadFees();
        await loadExams();
        await loadNotifications();
        updateStats();
    } else {
        document.getElementById('analytics-section').style.display = 'none';
    }
});

function updateStats() {
    document.getElementById('stat-students').innerText = allStudents.length;
    document.getElementById('stat-classes').innerText = allClasses.length;
    document.getElementById('stat-teachers').innerText = allTeachers.length;
    document.getElementById('stat-exams').innerText = allExams.length;
    const total = allFees.reduce((sum, f) => sum + f.amount, 0);
    document.getElementById('stat-fees').innerText = 'Tsh ' + total.toLocaleString();
}

// LOAD CLASSES (Na Kitufe cha Kufuta)
async function loadClasses() {
    const res = await fetch(`${API_BASE}/classes?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allClasses = data.classes || [];
    const options = '<option value="">-- Chagua Darasa --</option>' + allClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    ['student-class', 'att-class', 'exam-class', 'assign-class'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).innerHTML = options;
    });
    
    const tbody = document.getElementById('classes-table-body');
    if (tbody) {
        tbody.innerHTML = allClasses.map((c, i) => `
            <tr>
                <td>${i+1}</td>
                <td>${c.name}</td>
                <td>${c.level_type}</td>
                <td><button onclick="deleteClass(${c.id})" class="btn-red" style="padding: 4px 8px; font-size:12px;">Futa</button></td>
            </tr>
        `).join('') || '<tr><td colspan="4">Hakuna madarasa.</td></tr>';
    }
}

// LOAD SUBJECTS (Na Kitufe cha Kufuta)
async function loadSubjects() {
    const res = await fetch(`${API_BASE}/academics/subjects?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allSubjects = data.subjects || [];
    const options = '<option value="">-- Chagua Somo --</option>' + allSubjects.map(s => `<option value="${s.id}">${s.name} (${s.level_type})</option>`).join('');
    ['marks-subject', 'assign-subject'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).innerHTML = options;
    });
    
    const tbody = document.getElementById('subjects-table-body');
    if (tbody) {
        tbody.innerHTML = allSubjects.map((s, i) => `
            <tr>
                <td>${i+1}</td><td>${s.code}</td><td>${s.name}</td><td>${s.level_type}</td><td>${s.category}</td>
                <td><button onclick="alert('Kufuta somo litakuja kwenye toleo lijalo')" class="btn-red" style="padding: 4px 8px; font-size:12px;">Futa</button></td>
            </tr>
        `).join('') || '<tr><td colspan="6">Hakuna masomo.</td></tr>';
    }
}

// LOAD STUDENTS (Na Kitufe cha Kufuta)
async function loadStudents() {
    const res = await fetch(`${API_BASE}/students?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allStudents = data.students || [];
    const options = '<option value="">-- Chagua Mwanafunzi --</option>' + allStudents.map(s => `<option value="${s.id}">${s.full_name}</option>`).join('');
    ['fee-student', 'marks-student'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).innerHTML = options;
    });
    
    const tbody = document.getElementById('students-table-body');
    if (tbody) {
        tbody.innerHTML = allStudents.map((s, i) => {
            const cls = allClasses.find(c => c.id === s.class_id)?.name || '-';
            return `
                <tr>
                    <td>${i+1}</td>
                    <td>${s.full_name}</td>
                    <td>${s.gender}</td>
                    <td>${cls}</td>
                    <td>${s.parent_phone || '-'}</td>
                    <td><button onclick="deleteStudent(${s.id})" class="btn-red" style="padding: 4px 8px; font-size:12px;">Futa</button></td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="6">Hakuna wanafunzi.</td></tr>';
    }
}

// FUNCTIONS ZA KUFUTA (DELETE)
async function deleteClass(id) {
    if (!confirm("Una uhakika unataka kufuta darasa hili? Wanafunzi walio kwenye darasa hili wataondolewa darasa.")) return;
    try {
        const res = await fetch(`${API_BASE}/classes/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) { alert("Darasa limefutwa!"); loadClasses(); updateStats(); }
    } catch (err) { alert("Kosa la mtandao"); }
}

async function deleteStudent(id) {
    if (!confirm("Una uhakika unataka kumfuta mwanafunzi huyu?")) return;
    try {
        const res = await fetch(`${API_BASE}/students/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) { alert("Mwanafunzi amefutwa!"); loadStudents(); updateStats(); }
    } catch (err) { alert("Kosa la mtandao"); }
}

// LOAD TEACHERS
async function loadTeachers() {
    const res = await fetch(`${API_BASE}/teachers?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allTeachers = data.teachers || [];
    if(document.getElementById('assign-teacher')) document.getElementById('assign-teacher').innerHTML = '<option value="">-- Chagua Mwalimu --</option>' + allTeachers.map(t => `<option value="${t.id}">${t.full_name}</option>`).join('');
    const tbody = document.getElementById('teachers-table-body');
    if (tbody) tbody.innerHTML = allTeachers.map((t, i) => `<tr><td>${i+1}</td><td>${t.full_name}</td><td>${t.phone || '-'}</td><td>${t.gender || '-'}</td></tr>`).join('') || '<tr><td colspan="4">Hakuna walimu.</td></tr>';
}

// LOAD FEES
async function loadFees() {
    const res = await fetch(`${API_BASE}/fees/school/${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allFees = data.fees || [];
    const tbody = document.getElementById('fees-table-body');
    if(tbody) tbody.innerHTML = allFees.map((f,i) => `<tr><td>${f.full_name}</td><td>Tsh ${f.amount.toLocaleString()}</td><td>${f.term}</td><td><button onclick="printReceipt(${f.id})" class="btn-blue" style="padding:4px 8px;">Chapisha</button></td></tr>`).join('') || '<tr><td colspan="4">Hakuna malipo.</td></tr>';
}

// LOAD EXAMS
async function loadExams() {
    const res = await fetch(`${API_BASE}/exams?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allExams = data.exams || [];
    if(document.getElementById('marks-exam')) document.getElementById('marks-exam').innerHTML = '<option value="">-- Chagua Mtihani --</option>' + allExams.map(e => `<option value="${e.id}">${e.name} (${e.term})</option>`).join('');
}

// LOAD NOTIFICATIONS
async function loadNotifications() {
    const res = await fetch(`${API_BASE}/notifications?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const list = document.getElementById('notifications-list');
    if(list) list.innerHTML = (data.notifications || []).map(n => `<div style="background:#fff; padding:10px; margin-bottom:10px; border-left:4px solid #3498db;"><strong>${n.title}</strong><p>${n.message}</p></div>`).join('') || '<p>Hakuna taarifa.</p>';
}

// SUBMIT FORMS
document.getElementById('class-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { school_id: currentSchoolId, name: document.getElementById('class-name').value, level_type: document.getElementById('class-level').value };
    const res = await fetch(`${API_BASE}/classes`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
    if (res.ok) { alert("Darasa limesajiliwa!"); document.getElementById('class-form').reset(); loadClasses(); updateStats(); }
});

document.getElementById('student-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { school_id: currentSchoolId, class_id: document.getElementById('student-class').value, full_name: document.getElementById('student-name').value, gender: document.getElementById('student-gender').value, admission_number: document.getElementById('student-adm').value, parent_phone: document.getElementById('student-parent-phone').value };
    const res = await fetch(`${API_BASE}/students`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
    if (res.ok) { alert("Mwanafunzi amesajiliwa!"); document.getElementById('student-form').reset(); loadStudents(); updateStats(); }
});

document.getElementById('teacher-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { school_id: currentSchoolId, full_name: document.getElementById('teacher-name').value, phone: document.getElementById('teacher-phone').value, gender: document.getElementById('teacher-gender').value };
    const res = await fetch(`${API_BASE}/teachers`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
    if (res.ok) { alert("Mwalimu amesajiliwa!"); document.getElementById('teacher-form').reset(); loadTeachers(); updateStats(); }
});

document.getElementById('fee-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { school_id: currentSchoolId, student_id: document.getElementById('fee-student').value, amount: parseFloat(document.getElementById('fee-amount').value), term: document.getElementById('fee-term').value, year: parseInt(document.getElementById('fee-year').value) };
    const res = await fetch(`${API_BASE}/fees`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
    if (res.ok) { alert("Malipo yamerekodiwa!"); document.getElementById('fee-form').reset(); loadFees(); updateStats(); }
});

document.getElementById('notification-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { school_id: currentSchoolId, title: document.getElementById('notif-title').value, message: document.getElementById('notif-message').value };
    const res = await fetch(`${API_BASE}/notifications`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
    if (res.ok) { alert("Taarifa imetumwa!"); document.getElementById('notification-form').reset(); loadNotifications(); }
});

// PRINT RECEIPT & SECTION TOGGLE
function printReceipt(id) {
    const f = allFees.find(x => x.id === id);
    document.getElementById('printable-area').innerHTML = `<div style="text-align:center; border-bottom:2px dashed #000; padding-bottom:10px; margin-bottom:20px;"><h2>RISITI YA MALIPO</h2></div><p><strong>Mwanafunzi:</strong> ${f.full_name}</p><p><strong>Kiasi:</strong> Tsh ${f.amount.toLocaleString()}</p><p><strong>Muhula:</strong> ${f.term} (${f.year})</p>`;
    document.getElementById('printable-area').style.display = 'block';
    window.print();
    document.getElementById('printable-area').style.display = 'none';
}

function showSection(id) {
    ['teachers', 'students', 'classes', 'fees', 'attendance', 'exams', 'notifications', 'subjects'].forEach(s => {
        const el = document.getElementById(`${s}-section`);
        if(el) el.style.display = 'none';
    });
    const target = document.getElementById(`${id}-section`);
    if(target) target.style.display = 'block';
    if(!currentSchoolId) alert("Chagua shule kwanza!");
}