const API_BASE = '/api'; 
let token = localStorage.getItem('token');
let currentSchoolId = null;
let allExams = [];
let allStudents = [];
let allSubjects = [];
let allClasses = [];

if (token) { showDashboard(); }

// 1. LOGIN & DASHBOARD
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

async function loadSchools() {
    const res = await fetch(`${API_BASE}/schools`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    if (data.schools) {
        const sel = document.getElementById('school-selector');
        sel.innerHTML = '<option value="">-- Chagua Shule --</option>';
        data.schools.forEach(s => sel.innerHTML += `<option value="${s.id}">${s.name}</option>`);
    }
}

// 2. MABADILIKO YA SHULE
document.getElementById('school-selector').addEventListener('change', async (e) => {
    currentSchoolId = e.target.value;
    if (currentSchoolId) {
        await loadClasses();
        await loadStudents();
        await loadSubjects();
        await loadExams();
    }
});

// 3. KUSAJILI SHULE NA MADARASA
function toggleSchoolForm() {
    const c = document.getElementById('school-form-container');
    c.style.display = c.style.display === 'none' ? 'block' : 'none';
}

document.getElementById('school-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
        name: document.getElementById('school-name').value, code: document.getElementById('school-code').value,
        region: document.getElementById('school-region').value, district: document.getElementById('school-district').value,
        ward: document.getElementById('school-ward').value, exam_center_no: document.getElementById('school-exam-no').value,
        headmaster_name: document.getElementById('school-headmaster').value, ownership: document.getElementById('school-ownership').value,
        language: document.getElementById('school-language').value, schoolLevels: ['O_LEVEL', 'A_LEVEL', 'PRIMARY']
    };
    try {
        const res = await fetch(`${API_BASE}/schools`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
        const data = await res.json();
        if (res.ok) {
            alert("Shule imesajiliwa!"); document.getElementById('school-form').reset(); toggleSchoolForm(); loadSchools();
        } else { alert("KOSA: " + data.error); }
    } catch (err) { alert("Hitilafu ya Mtandao."); }
});

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

// 4. KUVUTA WANAFUNZI NA MASOMO
async function loadStudents() {
    const res = await fetch(`${API_BASE}/students?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allStudents = data.students || [];
    if(document.getElementById('marks-student')) document.getElementById('marks-student').innerHTML = '<option value="">-- Chagua Mwanafunzi --</option>' + allStudents.map(s => `<option value="${s.id}">${s.full_name}</option>`).join('');
    
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

async function loadSubjects() {
    const res = await fetch(`${API_BASE}/academics/subjects?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allSubjects = data.subjects || [];
    if(document.getElementById('marks-subject')) document.getElementById('marks-subject').innerHTML = '<option value="">-- Chagua Somo --</option>' + allSubjects.map(s => `<option value="${s.id}">${s.name} (${s.level_type})</option>`).join('');
}

// 5. MITIHANI NA UCHAMBUZI (ANALYTICS)
async function loadExams() {
    const res = await fetch(`${API_BASE}/exams?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allExams = data.exams || [];
    const options = '<option value="">-- Chagua Mtihani --</option>' + allExams.map(e => `<option value="${e.id}">${e.name} (${e.term})</option>`).join('');
    if(document.getElementById('marks-exam')) document.getElementById('marks-exam').innerHTML = options;
    if(document.getElementById('process-exam-select')) document.getElementById('process-exam-select').innerHTML = options;
}

document.getElementById('create-exam-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentSchoolId) return alert("Chagua shule kwanza!");
    const body = { school_id: currentSchoolId, class_id: document.getElementById('exam-class').value, name: document.getElementById('exam-name').value, term: document.getElementById('exam-term').value, year: parseInt(document.getElementById('exam-year').value) };
    const res = await fetch(`${API_BASE}/exams`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
    if (res.ok) { alert("Mtihani umetengenezwa!"); document.getElementById('create-exam-form').reset(); await loadExams(); }
});

document.getElementById('add-marks-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { exam_id: document.getElementById('marks-exam').value, student_id: document.getElementById('marks-student').value, subject_id: document.getElementById('marks-subject').value, marks: parseFloat(document.getElementById('marks-score').value) };
    const res = await fetch(`${API_BASE}/exams/results`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
    if (res.ok) { alert("Alama zimehifadhiwa!"); document.getElementById('add-marks-form').reset(); }
});

// HAPA NDIO LOGIC YA BROADSHEET NA ANALYTICS
async function loadBroadsheet() {
    const examId = document.getElementById('process-exam-select').value;
    if (!examId) return alert("Chagua mtihani kwanza!");
    try {
        const res = await fetch(`${API_BASE}/exams/processed/${examId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) return alert(data.error);

        // Onyesha Maeneo
        document.getElementById('broadsheet-container').style.display = 'block';
        document.getElementById('analytics-container').style.display = 'block';
        document.getElementById('broadsheet-title').innerText = `MATOKEO: ${data.exam.name.toUpperCase()} - ${data.exam.term.toUpperCase()}`;

        // 1. Jaza Broadsheet
        const tbody = document.getElementById('broadsheet-body');
        tbody.innerHTML = '';
        data.results.forEach(r => {
            tbody.innerHTML += `<tr><td><strong>${r.rank}</strong></td><td>${r.admission_number}</td><td class="name-col">${r.full_name}</td><td>${r.gender}</td><td>${r.totalMarks}</td><td><strong>${r.aggregatePoints}</strong></td><td>${r.gpa}</td><td><strong>${r.division}</strong></td></tr>`;
        });

        // 2. Jaza Uchambuzi (Analytics)
        const results = data.results;
        
        // Top 20 (Wanafunzi wanaongoza kwa rank)
        const top20 = results.slice(0, 20);
        document.getElementById('top-20-list').innerHTML = top20.map(r => `<li>${r.full_name} - Pointi: ${r.aggregatePoints}, GPA: ${r.gpa}</li>`).join('') || '<li>Hakuna data.</li>';

        // Bottom 20 (Wanafunzi wa mwisho)
        const bottom20 = [...results].reverse().slice(0, 20);
        document.getElementById('bottom-20-list').innerHTML = bottom20.map(r => `<li>${r.full_name} - Pointi: ${r.aggregatePoints}, GPA: ${r.gpa}</li>`).join('') || '<li>Hakuna data.</li>';

        // Wanafunzi wenye F 3 au zaidi
        const fStudents = results.filter(r => {
            const fCount = r.subjects.filter(s => s.grade === 'F').length;
            return fCount >= 3;
        });
        document.getElementById('f-list').innerHTML = fStudents.map(r => `<li>${r.full_name} (Ana F: ${r.subjects.filter(s => s.grade === 'F').length})</li>`).join('') || '<li>Hakuna mwanafunzi mwenye F 3+.</li>';

        // Wanafunzi Bora kwa Makundi (Tunachukua aliyepata pointi chini zaidi kwenye somo husika)
        const getTopStudentByCategory = (category) => {
            let bestStudent = null;
            let bestPoints = 999;
            
            results.forEach(student => {
                // Tafuta masomo ya mwanafunzi huyu yenye category hii
                const categorySubjects = student.subjects.filter(s => {
                    const subInfo = allSubjects.find(sub => sub.name === s.subject_name);
                    return subInfo && subInfo.category === category;
                });
                
                if (categorySubjects.length > 0) {
                    // Chukua pointi zake bora kwenye hiyo category
                    const minPoints = Math.min(...categorySubjects.map(s => s.points));
                    if (minPoints < bestPoints) {
                        bestPoints = minPoints;
                        bestStudent = student.full_name;
                    }
                }
            });
            return bestStudent ? `${bestStudent} (Pointi: ${bestPoints})` : 'Hakuna data';
        };

        document.getElementById('top-science').innerText = getTopStudentByCategory('SCIENCE');
        document.getElementById('top-business').innerText = getTopStudentByCategory('BUSINESS');
        document.getElementById('top-arts').innerText = getTopStudentByCategory('ARTS');

    } catch (err) { alert("Kosa la kuvuta matokeo: " + err.message); }
}

// 6. SHOW SECTION
function showSection(id) {
    ['students', 'classes', 'exams'].forEach(s => {
        const el = document.getElementById(`${s}-section`);
        if(el) el.style.display = 'none';
    });
    const target = document.getElementById(`${id}-section`);
    if(target) target.style.display = 'block';
    if(!currentSchoolId) alert("Chagua shule kwanza!");
}