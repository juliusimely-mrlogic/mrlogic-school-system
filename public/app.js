const API_BASE = '/api'; 
let token = localStorage.getItem('token');
let currentSchoolId = null;
let allExams = [];
let allStudents = [];
let allSubjects = [];
let allClasses = [];
let currentProcessedData = null;
let currentUserRole = localStorage.getItem('user_role');

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
            localStorage.setItem('user_role', data.user.role);
            localStorage.setItem('is_password_changed', data.user.is_password_changed);
            
            token = data.token;
            currentUserRole = data.user.role;

            if (data.user.is_password_changed === 0) {
                setTimeout(() => {
                    alert("Karibu! Kwa usalama, tafadhali badilisha password yako ya awali (1000).");
                    promptChangePassword();
                }, 500);
            }

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
    
    if (currentUserRole === 'SUPER_ADMIN' || currentUserRole === 'SCHOOL_MANAGER') {
        if(document.getElementById('menu-users')) document.getElementById('menu-users').style.display = 'block';
        loadUsers();
    } else {
        if(document.getElementById('menu-users')) document.getElementById('menu-users').style.display = 'none';
    }
}

function promptChangePassword() {
    const newPassword = prompt("Weka password au PIN mpya (Herufi 4 au zaidi):");
    if (!newPassword) return;
    
    if (newPassword.length < 4) return alert("Password ni lazima iwe na herufi 4 au zaidi.");

    fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ newPassword })
    })
    .then(res => res.json())
    .then(data => {
        if (data.message) {
            alert(data.message);
            localStorage.setItem('is_password_changed', 1);
        } else {
            alert("Kosa: " + data.error);
        }
    }).catch(err => alert("Hitilafu ya mtandao."));
}

// 2. SHULE
async function loadSchools() {
    const res = await fetch(`${API_BASE}/schools`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    if (data.schools) {
        const sel = document.getElementById('school-selector');
        sel.innerHTML = '<option value="">-- Chagua Shule --</option>';
        data.schools.forEach(s => sel.innerHTML += `<option value="${s.id}">${s.name}</option>`);
        
        if (currentUserRole !== 'SUPER_ADMIN' && data.schools.length > 0) {
            sel.value = data.schools[0].id;
            sel.dispatchEvent(new Event('change'));
            sel.disabled = true; 
        } else {
            sel.disabled = false;
        }
    }
}

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

// 3. MABADILIKO YA SHULE
document.getElementById('school-selector').addEventListener('change', async (e) => {
    currentSchoolId = e.target.value;
    if (currentSchoolId) {
        if(document.getElementById('user-school')) document.getElementById('user-school').value = currentSchoolId;
        await loadClasses();
        await loadStudents();
        await loadSubjects();
        await loadExams();
    }
});

// 4. WATUMIAJI
async function loadUsers() {
    try {
        const res = await fetch(`${API_BASE}/users`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        const tbody = document.getElementById('users-table-body');
        if(tbody) {
            tbody.innerHTML = data.users.map(u => `
                <tr>
                    <td>${u.full_name}</td>
                    <td><strong>${u.username}</strong></td>
                    <td>${u.role}</td>
                    <td>${u.school_name || 'N/A'}</td>
                </tr>
            `).join('');
        }
    } catch (err) { console.error(err); }
}

document.getElementById('user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
        school_id: document.getElementById('user-school').value,
        full_name: document.getElementById('user-name').value,
        role: document.getElementById('user-role').value
    };

    if (currentUserRole !== 'SUPER_ADMIN') {
        body.school_id = null; 
    } else {
        body.school_id = currentSchoolId;
    }

    try {
        const res = await fetch(`${API_BASE}/users`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (res.ok) {
            alert(`Mtumiaji amesajiliwa!\n\nUsername: ${data.user.username}\nPassword ya Awali: ${data.user.defaultPassword}\n\nMpe mtumiaji hizi taarifa.`);
            document.getElementById('user-form').reset();
            loadUsers();
        } else {
            alert("Kosa: " + data.error);
        }
    } catch (err) { alert("Hitilafu ya mtandao"); }
});

// 5. MADARASA
async function loadClasses() {
    const res = await fetch(`${API_BASE}/classes?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allClasses = data.classes || [];
    const options = '<option value="">-- Chagua Darasa --</option>' + allClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    ['student-class', 'exam-class', 'struct-class'].forEach(id => { 
        if(document.getElementById(id)) document.getElementById(id).innerHTML = options; 
    });
    
    const tbody = document.getElementById('classes-table-body');
    if (tbody) {
        tbody.innerHTML = allClasses.map((c, i) => `
            <tr><td>${i+1}</td><td>${c.name}</td><td>${c.level_type}</td>
            <td><button onclick="deleteClass(${c.id})" class="btn-red" style="padding: 4px 8px; font-size:12px; border:none; color:white; border-radius:3px;">Futa</button></td></tr>
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

// 6. WANAFUNZI
async function loadStudents() {
    const res = await fetch(`${API_BASE}/students?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allStudents = data.students || [];
    
    const stdOptions = '<option value="">-- Chagua Mwanafunzi --</option>' + allStudents.map(s => `<option value="${s.id}">${s.full_name}</option>`).join('');
    ['marks-student', 'report-student-select', 'fee-student'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).innerHTML = stdOptions;
    });
    
    const tbody = document.getElementById('students-table-body');
    if (tbody) {
        tbody.innerHTML = allStudents.map((s, i) => {
            const cls = allClasses.find(c => c.id === s.class_id)?.name || '-';
            return `<tr><td>${i+1}</td><td>${s.full_name}</td><td>${s.gender}</td><td>${cls}</td><td>${s.parent_phone || '-'}</td>
            <td><button onclick="deleteStudent(${s.id})" class="btn-red" style="padding: 4px 8px; font-size:12px; border:none; color:white; border-radius:3px;">Futa</button></td></tr>`;
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

// 7. MASOMO
async function loadSubjects() {
    const res = await fetch(`${API_BASE}/academics/subjects?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allSubjects = data.subjects || [];
    if(document.getElementById('marks-subject')) document.getElementById('marks-subject').innerHTML = '<option value="">-- Chagua Somo --</option>' + allSubjects.map(s => `<option value="${s.id}">${s.name} (${s.level_type})</option>`).join('');
}

// 8. MITIHANI
async function loadExams() {
    const res = await fetch(`${API_BASE}/exams?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allExams = data.exams || [];
    const options = '<option value="">-- Chagua Mtihani --</option>' + allExams.map(e => `<option value="${e.id}">${e.name} (${e.term})</option>`).join('');
    
    ['marks-exam', 'process-exam-select', 'report-exam-select'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).innerHTML = options;
    });
}

document.getElementById('create-exam-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentSchoolId) return alert("Chagua shule kwanza!");
    const class_id = document.getElementById('exam-class').value;
    if(!class_id) return alert("Chagua darasa kwanza!");

    try {
        const res = await fetch(`${API_BASE}/exams`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ school_id: currentSchoolId, class_id, name: document.getElementById('exam-name').value, term: document.getElementById('exam-term').value, year: parseInt(document.getElementById('exam-year').value) })
        });
        if (res.ok) {
            alert("Mtihani umetengenezwa!"); document.getElementById('create-exam-form').reset(); await loadExams();
        } else { const err = await res.json(); alert("Kosa: " + err.error); }
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

        currentProcessedData = data; 
        document.getElementById('broadsheet-container').style.display = 'block';
        
        document.getElementById('broadsheet-title').innerText = `MATOKEO: ${data.exam.name.toUpperCase()} - ${data.exam.term.toUpperCase()}`;

        const tbody = document.getElementById('broadsheet-body');
        tbody.innerHTML = '';
        data.results.forEach(r => {
            tbody.innerHTML += `<tr><td><strong>${r.rank}</strong></td><td>${r.admission_number}</td><td class="name-col">${r.full_name}</td><td>${r.gender}</td><td>${r.totalMarks}</td><td><strong>${r.aggregatePoints}</strong></td><td>${r.gpa}</td><td><strong>${r.division}</strong></td></tr>`;
        });
    } catch (err) { alert("Kosa la kuvuta matokeo: " + err.message); }
}

// 9. CHAPISHA RIPOTI
async function printReportCard() {
    const examId = document.getElementById('report-exam-select').value;
    const studentId = document.getElementById('report-student-select').value;

    if (!examId || !studentId) return alert("Tafadhali chagua mtihani na mwanafunzi kwanza!");

    try {
        if (!currentProcessedData || currentProcessedData.exam.id != examId) {
            const res = await fetch(`${API_BASE}/exams/processed/${examId}`, { headers: { 'Authorization': `Bearer ${token}` } });
            currentProcessedData = await res.json();
        }

        const studentResult = currentProcessedData.results.find(r => r.id == studentId);
        const exam = currentProcessedData.exam;
        const schoolName = document.getElementById('school-selector').options[document.getElementById('school-selector').selectedIndex].text;

        if (!studentResult) return alert("Matokeo ya mwanafunzi huyu hayapo kwenye mtihani huu.");

        let subjectRows = studentResult.subjects.map(s => `
            <tr>
                <td style="border: 1px solid #000; padding: 5px;">${s.subject_name}</td>
                <td style="border: 1px solid #000; padding: 5px; text-align: center;">${s.marks}</td>
                <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold;">${s.grade}</td>
                <td style="border: 1px solid #000; padding: 5px; text-align: center;">${s.points}</td>
            </tr>
        `).join('');

        const reportHTML = `
            <div style="padding: 40px; font-family: 'Times New Roman', Times, serif;">
                <div style="text-align: center; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
                    <h1 style="margin: 0; text-transform: uppercase;">${schoolName}</h1>
                    <h3 style="margin: 5px 0;">RIPOTI YA MATOKEO YA MWANAFUNZI</h3>
                    <p style="margin: 0;">Mtihani: ${exam.name} (${exam.term} ${exam.year})</p>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 16px;">
                    <div>
                        <p style="margin: 5px 0;"><strong>Jina la Mwanafunzi:</strong> ${studentResult.full_name}</p>
                        <p style="margin: 5px 0;"><strong>Namba ya Usajili:</strong> ${studentResult.admission_number}</p>
                    </div>
                    <div>
                        <p style="margin: 5px 0;"><strong>Jinsia:</strong> ${studentResult.gender}</p>
                        <p style="margin: 5px 0;"><strong>Nafasi (Rank):</strong> ${studentResult.rank} kati ya ${currentProcessedData.results.length}</p>
                    </div>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 16px; margin-bottom: 20px;">
                    <thead>
                        <tr style="background-color: #e0e0e0;">
                            <th style="border: 1px solid #000; padding: 8px; text-align: left;">Somo (Subject)</th>
                            <th style="border: 1px solid #000; padding: 8px;">Alama</th>
                            <th style="border: 1px solid #000; padding: 8px;">Daraja</th>
                            <th style="border: 1px solid #000; padding: 8px;">Pointi</th>
                        </tr>
                    </thead>
                    <tbody>${subjectRows}</tbody>
                </table>
                <div style="display: flex; justify-content: space-between; border: 2px solid #000; padding: 15px; font-size: 18px; font-weight: bold; margin-bottom: 50px;">
                    <div>Jumla: ${studentResult.totalMarks}</div>
                    <div>Pointi: ${studentResult.aggregatePoints}</div>
                    <div>GPA: ${studentResult.gpa}</div>
                    <div>Div: ${studentResult.division}</div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 50px;">
                    <div><p>Sahihi ya Mwalimu:</p><p style="margin-top: 40px;">...................................................</p></div>
                    <div><p>Sahihi ya Mkuu:</p><p style="margin-top: 40px;">...................................................</p></div>
                </div>
            </div>
        `;

        const printArea = document.getElementById('printable-report');
        printArea.innerHTML = reportHTML;
        window.print();
    } catch (err) { alert("Hitilafu: " + err.message); }
}

// 10. USIMAMIZI WA ADA
document.getElementById('fee-structure-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentSchoolId) return alert("Chagua shule kwanza!");

    const body = {
        school_id: currentSchoolId,
        class_id: document.getElementById('struct-class').value,
        term: document.getElementById('struct-term').value,
        year: parseInt(document.getElementById('struct-year').value),
        amount: parseFloat(document.getElementById('struct-amount').value)
    };

    try {
        const res = await fetch(`${API_BASE}/fees/structure`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(body)
        });
        if (res.ok) {
            alert("Ada imewekwa kikamilifu!");
            document.getElementById('fee-structure-form').reset();
        } else {
            const err = await res.json(); alert("Kosa: " + err.error);
        }
    } catch (err) { alert("Hitilafu ya mtandao"); }
});

async function loadFeeStatus() {
    if (!currentSchoolId) return alert("Chagua shule kwanza!");
    const term = document.getElementById('status-term').value;
    const year = parseInt(document.getElementById('status-year').value);

    try {
        const res = await fetch(`${API_BASE}/fees/status/${currentSchoolId}?term=${term}&year=${year}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        
        const tbody = document.getElementById('fee-status-body');
        tbody.innerHTML = '';

        if (data.statusList && data.statusList.length > 0) {
            data.statusList.forEach(s => {
                let rowColor = 'transparent';
                if (s.status === 'AMELIPA ZOTE') rowColor = '#d4edda';
                if (s.status === 'AMELIPA KIDOGO') rowColor = '#fff3cd';
                if (s.status === 'HAJALIPA') rowColor = '#f8d7da';

                tbody.innerHTML += `
                    <tr style="background-color: ${rowColor};">
                        <td><strong>${s.full_name}</strong></td>
                        <td>${s.class_name}</td>
                        <td>Tsh ${s.requiredAmount.toLocaleString()}</td>
                        <td>Tsh ${s.paidAmount.toLocaleString()}</td>
                        <td>Tsh ${s.balance.toLocaleString()}</td>
                        <td><strong>${s.status}</strong></td>
                    </tr>
                `;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Hakuna wanafunzi kwenye shule hii.</td></tr>';
        }
    } catch (err) { alert("Kosa la kuvuta hali ya ada."); }
}

document.getElementById('fee-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentSchoolId) return alert("Chagua shule kwanza!");

    const body = {
        school_id: currentSchoolId,
        student_id: document.getElementById('fee-student').value,
        amount: parseFloat(document.getElementById('fee-amount').value),
        term: document.getElementById('fee-term').value,
        year: parseInt(document.getElementById('fee-year').value)
    };

    try {
        const res = await fetch(`${API_BASE}/fees`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(body)
        });
        if (res.ok) {
            alert("Malipo yamerekodiwa kikamilifu!");
            document.getElementById('fee-form').reset();
            if(document.getElementById('fee-status-body').children.length > 0) {
                loadFeeStatus();
            }
        } else {
            const err = await res.json(); alert("Kosa: " + err.error);
        }
    } catch (err) { alert("Hitilafu ya mtandao"); }
});

// 11. SHOW SECTION
function showSection(id) {
    ['students', 'classes', 'exams', 'fees', 'users'].forEach(s => {
        const el = document.getElementById(`${s}-section`);
        if(el) el.style.display = 'none';
    });
    const target = document.getElementById(`${id}-section`);
    if(target) target.style.display = 'block';
    if(!currentSchoolId && id !== 'users') alert("Chagua shule kwanza!");
}