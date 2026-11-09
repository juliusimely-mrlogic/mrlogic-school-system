const API_BASE = '/api'; 
let token = localStorage.getItem('token');
let currentSchoolId = null;
let allExams = [];
let allStudents = [];
let allSubjects = [];

if (token) { showDashboard(); }

// LOGIN & DASHBOARD
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
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
});

document.getElementById('logout-btn').addEventListener('click', () => { localStorage.clear(); location.reload(); });

function showDashboard() {
    document.getElementById('welcome-msg').innerText = `Karibu, ${localStorage.getItem('user_name')}`;
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

document.getElementById('school-selector').addEventListener('change', async (e) => {
    currentSchoolId = e.target.value;
    if (currentSchoolId) {
        await loadExams();
        await loadStudents();
        await loadSubjects();
    }
});

// LOAD DATA KWA AJILI YA MITIHANI
async function loadExams() {
    const res = await fetch(`${API_BASE}/exams?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allExams = data.exams || [];
    const options = '<option value="">-- Chagua Mtihani --</option>' + allExams.map(e => `<option value="${e.id}">${e.name} (${e.term})</option>`).join('');
    if(document.getElementById('marks-exam')) document.getElementById('marks-exam').innerHTML = options;
    if(document.getElementById('process-exam-select')) document.getElementById('process-exam-select').innerHTML = options;
}

async function loadStudents() {
    const res = await fetch(`${API_BASE}/students?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allStudents = data.students || [];
    if(document.getElementById('marks-student')) document.getElementById('marks-student').innerHTML = '<option value="">-- Chagua Mwanafunzi --</option>' + allStudents.map(s => `<option value="${s.id}">${s.full_name}</option>`).join('');
}

async function loadSubjects() {
    const res = await fetch(`${API_BASE}/academics/subjects?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allSubjects = data.subjects || [];
    if(document.getElementById('marks-subject')) document.getElementById('marks-subject').innerHTML = '<option value="">-- Chagua Somo --</option>' + allSubjects.map(s => `<option value="${s.id}">${s.name} (${s.level_type})</option>`).join('');
}

// HIFADHI ALAMA
document.getElementById('add-marks-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { exam_id: document.getElementById('marks-exam').value, student_id: document.getElementById('marks-student').value, subject_id: document.getElementById('marks-subject').value, marks: parseFloat(document.getElementById('marks-score').value) };
    const res = await fetch(`${API_BASE}/exams/results`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
    if (res.ok) { alert("Alama zimehifadhiwa!"); document.getElementById('add-marks-form').reset(); }
});

// KUVUTA NA KUCHAKATA BROADSHEET
async function loadBroadsheet() {
    const examId = document.getElementById('process-exam-select').value;
    if (!examId) return alert("Chagua mtihani kwanza!");

    try {
        const res = await fetch(`${API_BASE}/exams/processed/${examId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();

        if (!res.ok) return alert(data.error);

        // Onyesha eneo la broadsheet
        document.getElementById('broadsheet-container').style.display = 'block';
        document.getElementById('broadsheet-title').innerText = `MATOKEO: ${data.exam.name.toUpperCase()} - ${data.exam.term.toUpperCase()}`;

        const tbody = document.getElementById('broadsheet-body');
        tbody.innerHTML = '';

        data.results.forEach(r => {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${r.rank}</strong></td>
                    <td>${r.admission_number}</td>
                    <td class="name-col">${r.full_name}</td>
                    <td>${r.gender}</td>
                    <td>${r.totalMarks}</td>
                    <td><strong>${r.aggregatePoints}</strong></td>
                    <td>${r.gpa}</td>
                    <td><strong>${r.division}</strong></td>
                </tr>
            `;
        });
    } catch (err) {
        alert("Kosa la kuvuta matokeo: " + err.message);
    }
}

function showSection(id) {
    ['exams'].forEach(s => document.getElementById(`${s}-section`).style.display = 'none');
    document.getElementById(`${id}-section`).style.display = 'block';
}