const API_BASE = '/api'; 
let token = localStorage.getItem('token');
let currentSchoolId = null;
let allExams = [];
let allStudents = [];
let allSubjects = [];
let allClasses = [];

if (token) { showDashboard(); }

// 1. LOGIN
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: document.getElementById('username').value, password: document.getElementById('password').value })
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user_name', data.user.full_name);
            token = data.token;
            showDashboard();
        } else { document.getElementById('login-error').innerText = data.error; }
    } catch (err) { document.getElementById('login-error').innerText = 'Server haipatikani.'; }
});

document.getElementById('logout-btn').addEventListener('click', () => { localStorage.clear(); location.reload(); });

function showDashboard() {
    document.getElementById('welcome-msg').innerText = `Karibu, ${localStorage.getItem('user_name')}`;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard-screen').style.display = 'block';
    loadSchools();
}

// 2. SHULE
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
        } else { alert("KOSA: " + data.error); }
    } catch (err) { alert("Hitilafu ya Mtandao."); }
});

document.getElementById('school-selector').addEventListener('change', async (e) => {
    currentSchoolId = e.target.value;
    if (currentSchoolId) {
        await loadClasses();
        await loadStudents();
        await loadSubjects();
        await loadExams();
    }
});

// 3. MADARASA
async function loadClasses() {
    const res = await fetch(`${API_BASE}/classes?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allClasses = data.classes || [];
    const options = '<option value="">-- Chagua Darasa --</option>' + allClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    ['student-class', 'exam-class'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerHTML = options; });
    
    const tbody = document.getElementById('classes-table-body');
    if (tbody) {
        tbody.innerHTML = allClasses.map((c, i) => `
            <tr><td>${i+1}</td><td>${c.name}</td><td>${c.level_type}</td>
            <td><button onclick="deleteClass(${c.id})" class="btn-red" style="padding: 4px 8px; font-size:12px;">Futa</button></td></tr>
        `).join('') || '<tr><td colspan="4">Hakuna madarasa.</td></tr>';
    }
}

document.getElementById('class-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentSchoolId) return alert("Chagua shule kwanza!");
    const body = { school_id: currentSchoolId, name: document.getElementById('class-name').value, level_type: document.getElementById('class-level').value };
    const res = await fetch(`${API_BASE}/classes`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
    if (res.ok) { alert("Darasa limesajiliwa!"); document.getElementById('class-form').reset(); loadClasses(); }
});

async function deleteClass(id) {
    if (!confirm("Una uhakika unataka kufuta darasa hili?")) return;
    await fetch(`${API_BASE}/classes/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    loadClasses();
}

// 4. WANAFUNZI
async function loadStudents() {
    const res = await fetch(`${API_BASE}/students?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allStudents = data.students || [];
    const options = '<option value="">-- Chagua Mwanafunzi --</option>' + allStudents.map(s => `<option value="${s.id}">${s.full_name}</option>`).join('');
    if(document.getElementById('marks-student')) document.getElementById('marks-student').innerHTML = options;
    
    const tbody = document.getElementById('students-table-body');
    if (tbody) {
        tbody.innerHTML = allStudents.map((s, i) => {
            const cls = allClasses.find(c => c.id === s.class_id)?.name || '-';
            return `<tr><td>${i+1}</td><td>${s.full_name}</td><td>${s.gender}</td><td>${cls}</td><td>${s.parent_phone || '-'}</td>
            <td><button onclick="deleteStudent(${s.id})" class="btn-red" style="padding: 4px 8px; font-size:12px;">Futa</button></td></tr>`;
        }).join('') || '<tr><td colspan="6">Hakuna wanafunzi.</td></tr>';
    }
}

document.getElementById('student-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentSchoolId) return alert("Chagua shule kwanza!");
    const body = { school_id: currentSchoolId, class_id: document.getElementById('student-class').value, full_name: document.getElementById('student-name').value, gender: document.getElementById('student-gender').value, admission_number: document.getElementById('student-adm').value, parent_phone: document.getElementById('student-parent-phone').value };
    const res = await fetch(`${API_BASE}/students`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
    if (res.ok) { alert("Mwanafunzi amesajiliwa!"); document.getElementById('student-form').reset(); loadStudents(); }
});

async function deleteStudent(id) {
    if (!confirm("Una uhakika unataka kumfuta mwanafunzi huyu?")) return;
    await fetch(`${API_BASE}/students/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    loadStudents();
}

// 5. MASOMO
async function loadSubjects() {
    const res = await fetch(`${API_BASE}/academics/subjects?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allSubjects = data.subjects || [];
    if(document.getElementById('marks-subject')) {
        document.getElementById('marks-subject').innerHTML = '<option value="">-- Chagua Somo --</option>' + allSubjects.map(s => `<option value="${s.id}">${s.name} (${s.level_type})</option>`).join('');
    }
}

// 6. MITIHANI NA BROADSHEET (Logic ya Kutengeneza Imerudishwa)
async function loadExams() {
    const res = await fetch(`${API_BASE}/exams?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allExams = data.exams || [];
    const options = '<option value="">-- Chagua Mtihani --</option>' + allExams.map(e => `<option value="${e.id}">${e.name} (${e.term})</option>`).join('');
    if(document.getElementById('marks-exam')) document.getElementById('marks-exam').innerHTML = options;
    if(document.getElementById('process-exam-select')) document.getElementById('process-exam-select').innerHTML = options;
}

// HAPA NDIO CODE YA KUTENGENEZA MTIHANI ILIPOKUWEPO
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
        } else {
            const err = await res.json(); alert("Kosa: " + err.error);
        }
    } catch (err) { alert("Hitilafu ya mtandao"); }
});

document.getElementById('add-marks-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { exam_id: document.getElementById('marks-exam').value, student_id: document.getElementById('marks-student').value, subject_id: document.getElementById('marks-subject').value, marks: parseFloat(document.getElementById('marks-score').value) };
    const res = await fetch(`${API_BASE}/exams/results`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
    if (res.ok) { alert("Alama zimehifadhiwa!"); document.getElementById('add-marks-form').reset(); }
});

async function loadBroadsheet() {
    const examId = document.getElementById('process-exam-select').value;
    if (!examId) return alert("Chagua mtihani kwanza!");
    try {
        const res = await fetch(`${API_BASE}/exams/processed/${examId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) return alert(data.error);

        document.getElementById('broadsheet-container').style.display = 'block';
        document.getElementById('broadsheet-title').innerText = `MATOKEO: ${data.exam.name.toUpperCase()} - ${data.exam.term.toUpperCase()}`;
        const tbody = document.getElementById('broadsheet-body');
        tbody.innerHTML = '';
        data.results.forEach(r => {
            tbody.innerHTML += `<tr><td><strong>${r.rank}</strong></td><td>${r.admission_number}</td><td class="name-col">${r.full_name}</td><td>${r.gender}</td><td>${r.totalMarks}</td><td><strong>${r.aggregatePoints}</strong></td><td>${r.gpa}</td><td><strong>${r.division}</strong></td></tr>`;
        });
    } catch (err) { alert("Kosa la kuvuta matokeo."); }
}

// 7. SHOW SECTION
function showSection(id) {
    ['students', 'classes', 'exams'].forEach(s => {
        const el = document.getElementById(`${s}-section`);
        if(el) el.style.display = 'none';
    });
    const target = document.getElementById(`${id}-section`);
    if(target) target.style.display = 'block';
    if(!currentSchoolId) alert("Chagua shule kwanza!");
}