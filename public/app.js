const API_BASE = '/api'; 
let token = localStorage.getItem('token');
let currentSchoolId = null;
let allExams = [], allStudents = [], allSubjects = [], allClasses = [], allTeachers = [], currentProcessedData = null;
let currentUserRole = localStorage.getItem('user_role');
let allSchoolsData = [];

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. LOGIN
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('login-btn');
            btn.innerText = 'Inaingia...';
            document.getElementById('login-error').innerText = '';
            
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
                        setTimeout(() => { alert("Karibu! Tafadhali badilisha password yako ya awali (1000)."); promptChangePassword(); }, 500);
                    }
                    showDashboard();
                } else { 
                    document.getElementById('login-error').innerText = data.error; 
                }
            } catch (err) { 
                document.getElementById('login-error').innerText = 'Server haipatikani au imelala.'; 
            } finally {
                btn.innerText = 'Ingia Mfumoni';
            }
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', () => { localStorage.clear(); location.reload(); });
    }

    if (token) { showDashboard(); }

    // 2. BULK UPLOAD EXCEL
    const bulkForm = document.getElementById('bulk-upload-form');
    if (bulkForm) {
        bulkForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentSchoolId) return alert("Chagua shule kwanza!");
            const fileInput = document.getElementById('excel-file');
            const classId = document.getElementById('bulk-class').value;
            if (!fileInput.files.length || !classId) return alert("Chagua faili la Excel na Darasa!");

            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('school_id', currentSchoolId);
            formData.append('class_id', classId);

            const statusDiv = document.getElementById('bulk-status');
            statusDiv.innerText = "Inapakia... Tafadhali subiri.";
            statusDiv.style.color = "#e67e22";

            try {
                const res = await fetch(`${API_BASE}/students/bulk`, {
                    method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData
                });
                const data = await res.json();
                if (res.ok) {
                    statusDiv.innerText = data.message;
                    statusDiv.style.color = "#27ae60";
                    bulkForm.reset();
                    loadStudents();
                } else {
                    statusDiv.innerText = "Kosa: " + data.error;
                    statusDiv.style.color = "#e74c3c";
                }
            } catch (err) {
                statusDiv.innerText = "Hitilafu ya mtandao.";
                statusDiv.style.color = "#e74c3c";
            }
        });
    }

    // 3. KUP AKIA SAHIHI NA MUHURI
    const assetsForm = document.getElementById('school-assets-form');
    if (assetsForm) {
        assetsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentSchoolId) return alert("Chagua shule kwanza!");
            const sigFile = document.getElementById('signature-file').files[0];
            const stampFile = document.getElementById('stamp-file').files[0];
            const statusDiv = document.getElementById('assets-status');
            if (!sigFile && !stampFile) return alert("Chagua angalau picha moja!");

            statusDiv.innerText = "Inapakia picha...";
            statusDiv.style.color = "#e67e22";

            const toBase64 = file => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });

            try {
                let sigBase64 = null, stampBase64 = null;
                if (sigFile) sigBase64 = await toBase64(sigFile);
                if (stampFile) stampBase64 = await toBase64(stampFile);

                const res = await fetch(`${API_BASE}/schools/${currentSchoolId}/assets`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ headmaster_signature: sigBase64, school_stamp: stampBase64 })
                });
                
                const data = await res.json();
                if (res.ok) {
                    statusDiv.innerText = "Picha zimehifadhiwa!";
                    statusDiv.style.color = "#27ae60";
                    assetsForm.reset();
                    loadSchools();
                } else {
                    statusDiv.innerText = "Kosa: " + data.error;
                    statusDiv.style.color = "#e74c3c";
                }
            } catch (err) {
                statusDiv.innerText = "Hitilafu ya mtandao.";
                statusDiv.style.color = "#e74c3c";
            }
        });
    }

    // 4. SHULE FOMU
    const schoolForm = document.getElementById('school-form');
    if (schoolForm) {
        schoolForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const schoolLevels = [];
            document.querySelectorAll('.school-level:checked').forEach(cb => schoolLevels.push(cb.value));
            if(schoolLevels.length === 0) return alert("Tafadhali chagua angalau ngazi moja ya shule.");

            const body = {
                name: document.getElementById('school-name').value, code: document.getElementById('school-code').value,
                region: document.getElementById('school-region').value, district: document.getElementById('school-district').value,
                ward: document.getElementById('school-ward').value, exam_center_no: document.getElementById('school-exam-no').value,
                headmaster_name: document.getElementById('school-headmaster').value, ownership: document.getElementById('school-ownership').value,
                language: document.getElementById('school-language').value, schoolLevels: schoolLevels 
            };
            
            try {
                const res = await fetch(`${API_BASE}/schools`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
                const data = await res.json();
                if (res.ok) {
                    alert(`Shule imesajiliwa! Madarasa ${data.classesCreated} yametengenezwa.`); 
                    schoolForm.reset(); toggleSchoolForm(); loadSchools();
                } else { alert("KOSA: " + data.error); }
            } catch (err) { alert("Hitilafu ya Mtandao."); }
        });
    }

    // 5. WATUMIAJI FOMU
    const userForm = document.getElementById('user-form');
    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = {
                school_id: document.getElementById('user-school').value,
                full_name: document.getElementById('user-name').value,
                role: document.getElementById('user-role').value
            };
            if (currentUserRole !== 'SUPER_ADMIN') body.school_id = null; 

            const res = await fetch(`${API_BASE}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
            const data = await res.json();
            if (res.ok) {
                alert(`Mtumiaji amesajiliwa!\nUsername: ${data.user.username}\nPassword: ${data.user.defaultPassword}`);
                userForm.reset();
                loadUsers();
            } else { alert("Kosa: " + data.error); }
        });
    }

    // 6. MADARASA FOMU
    const classForm = document.getElementById('class-form');
    if (classForm) {
        classForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = { school_id: currentSchoolId, name: document.getElementById('class-name').value, level_type: document.getElementById('class-level').value };
            const res = await fetch(`${API_BASE}/classes`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
            if (res.ok) { alert("Darasa limesajiliwa!"); classForm.reset(); loadClasses(); }
        });
    }

    // 7. WANAFUNZI FOMU
    const studentForm = document.getElementById('student-form');
    if (studentForm) {
        studentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = { school_id: currentSchoolId, class_id: document.getElementById('student-class').value, full_name: document.getElementById('student-name').value, gender: document.getElementById('student-gender').value, admission_number: document.getElementById('student-adm').value, parent_phone: document.getElementById('student-parent-phone').value };
            const res = await fetch(`${API_BASE}/students`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
            if (res.ok) { alert("Mwanafunzi amesajiliwa!"); studentForm.reset(); loadStudents(); }
        });
    }

    // 8. WALIMU FOMU
    const teacherForm = document.getElementById('teacher-form');
    if (teacherForm) {
        teacherForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = { school_id: currentSchoolId, full_name: document.getElementById('teacher-name').value, phone: document.getElementById('teacher-phone').value, gender: document.getElementById('teacher-gender').value };
            const res = await fetch(`${API_BASE}/teachers`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
            if (res.ok) { alert("Mwalimu amesajiliwa!"); teacherForm.reset(); loadTeachers(); }
        });
    }

    // 9. MGAWANYO FOMU
    const assignmentForm = document.getElementById('assignment-form');
    if (assignmentForm) {
        assignmentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = { school_id: currentSchoolId, teacher_id: document.getElementById('assign-teacher').value, class_id: document.getElementById('assign-class').value, subject_id: document.getElementById('assign-subject').value };
            const res = await fetch(`${API_BASE}/teachers/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
            if (res.ok) { alert("Mgawanyo umefanikiwa!"); loadTeachers(); }
        });
    }

    // 10. MITIHANI FOMU
    const createExamForm = document.getElementById('create-exam-form');
    if (createExamForm) {
        createExamForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = { school_id: currentSchoolId, class_id: document.getElementById('exam-class').value, name: document.getElementById('exam-name').value, term: document.getElementById('exam-term').value, year: parseInt(document.getElementById('exam-year').value) };
            const res = await fetch(`${API_BASE}/exams`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
            if (res.ok) { alert("Mtihani umetengenezwa!"); createExamForm.reset(); loadExams(); }
        });
    }

    const addMarksForm = document.getElementById('add-marks-form');
    if (addMarksForm) {
        addMarksForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = { exam_id: document.getElementById('marks-exam').value, student_id: document.getElementById('marks-student').value, subject_id: document.getElementById('marks-subject').value, marks: parseFloat(document.getElementById('marks-score').value) };
            const res = await fetch(`${API_BASE}/exams/results`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
            if (res.ok) { alert("Alama zimehifadhiwa!"); addMarksForm.reset(); }
        });
    }

    // 11. ADA FOMU
    const feeStructureForm = document.getElementById('fee-structure-form');
    if (feeStructureForm) {
        feeStructureForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = { school_id: currentSchoolId, class_id: document.getElementById('struct-class').value, term: document.getElementById('struct-term').value, year: parseInt(document.getElementById('struct-year').value), amount: parseFloat(document.getElementById('struct-amount').value) };
            const res = await fetch(`${API_BASE}/fees/structure`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
            if (res.ok) { alert("Ada imewekwa!"); feeStructureForm.reset(); }
        });
    }

    const feeForm = document.getElementById('fee-form');
    if (feeForm) {
        feeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = { school_id: currentSchoolId, student_id: document.getElementById('fee-student').value, amount: parseFloat(document.getElementById('fee-amount').value), term: document.getElementById('fee-term').value, year: parseInt(document.getElementById('fee-year').value) };
            const res = await fetch(`${API_BASE}/fees`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
            if (res.ok) { alert("Malipo yamerekodiwa!"); feeForm.reset(); }
        });
    }

    // 12. TAARIFA FOMU
    const notificationForm = document.getElementById('notification-form');
    if (notificationForm) {
        notificationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = { school_id: currentSchoolId, title: document.getElementById('notif-title').value, message: document.getElementById('notif-message').value };
            const res = await fetch(`${API_BASE}/notifications`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
            if (res.ok) { alert("Taarifa imetumwa!"); notificationForm.reset(); loadNotifications(); }
        });
    }

    // 13. MAHUDHURIO FOMU
    const attendanceForm = document.getElementById('attendance-form');
    if (attendanceForm) {
        attendanceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const class_id = document.getElementById('att-class').value; const date = document.getElementById('att-date').value;
            const selects = document.querySelectorAll('.att-status'); const records = [];
            selects.forEach(s => records.push({ student_id: parseInt(s.getAttribute('data-student-id')), status: s.value }));
            const res = await fetch(`${API_BASE}/attendance`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ school_id: currentSchoolId, class_id, date, records }) });
            if (res.ok) alert("Mahudhurio yamehifadhiwa!");
        });
    }
});

function showDashboard() {
    document.getElementById('welcome-msg').innerText = `Karibu, ${localStorage.getItem('user_name')}`;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard-screen').style.display = 'block';
    if (currentUserRole === 'SUPER_ADMIN' && document.getElementById('superadmin-dashboard')) {
        document.getElementById('superadmin-dashboard').style.display = 'block';
        fetchSuperAdminStats();
    }
    loadSchools();
}

async function fetchSuperAdminStats() {
    try {
        const res = await fetch(`${API_BASE}/superadmin/stats`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if(res.ok) {
            document.getElementById('sa-schools').innerText = data.totalSchools;
            document.getElementById('sa-districts').innerText = data.totalDistricts;
            document.getElementById('sa-students').innerText = data.totalStudents;
            document.getElementById('sa-fees').innerText = 'Tsh ' + data.totalSystemFees.toLocaleString();
        }
    } catch(err) { console.error(err); }
}

function promptChangePassword() {
    const newPassword = prompt("Weka password au PIN mpya (Herufi 4 au zaidi):");
    if (!newPassword || newPassword.length < 4) return alert("Password lazima iwe herufi 4+");
    fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ newPassword })
    }).then(res => res.json()).then(data => {
        alert(data.message || data.error);
        if(data.message) localStorage.setItem('is_password_changed', 1);
    });
}

async function loadSchools() {
    const res = await fetch(`${API_BASE}/schools`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    if (data.schools) {
        allSchoolsData = data.schools;
        const sel = document.getElementById('school-selector');
        sel.innerHTML = '<option value="">-- Chagua Shule --</option>';
        data.schools.forEach(s => sel.innerHTML += `<option value="${s.id}">${s.name}</option>`);
        
        const userSchoolSel = document.getElementById('user-school');
        if(userSchoolSel) {
            userSchoolSel.innerHTML = '<option value="">-- Chagua Shule --</option>';
            data.schools.forEach(s => userSchoolSel.innerHTML += `<option value="${s.id}">${s.name}</option>`);
        }

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

async function clearAllSchools() {
    if (!confirm("Una uhakika unataka kufuta shule ZOTE? Hii itafuta data zote za majaribio kwenye mfumo.")) return;
    try {
        const res = await fetch(`${API_BASE}/schools/clear-all`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            alert("Shule zote zimefutwa kikamilifu! Sasa unaweza kuanza upya.");
            loadSchools();
        } else {
            const data = await res.json();
            alert("Kosa: " + data.error);
        }
    } catch (err) { alert("Kosa la mtandao"); }
}

document.getElementById('school-selector').addEventListener('change', async (e) => {
    currentSchoolId = e.target.value;
    if (currentSchoolId) {
        await loadClasses(); 
        await loadStudents(); 
        await loadSubjects(); 
        await loadExams(); 
        await loadTeachers(); 
        await loadNotifications();
    }
});

async function loadClasses() {
    const res = await fetch(`${API_BASE}/classes?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allClasses = data.classes || [];
    const options = '<option value="">-- Chagua Darasa --</option>' + allClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    ['student-class', 'exam-class', 'struct-class', 'att-class', 'assign-class', 'bulk-class'].forEach(id => { 
        if(document.getElementById(id)) document.getElementById(id).innerHTML = options; 
    });
    
    const tbody = document.getElementById('classes-table-body');
    if (tbody) tbody.innerHTML = allClasses.map((c, i) => `<tr><td>${i+1}</td><td>${c.name}</td><td>${c.level_type}</td><td><button onclick="deleteClass(${c.id})" class="btn-red">Futa</button></td></tr>`).join('') || '<tr><td colspan="4">Hakuna madarasa.</td></tr>';
}

async function deleteClass(id) {
    if (!confirm("Futa darasa hili?")) return;
    await fetch(`${API_BASE}/classes/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    loadClasses();
}

async function loadStudents() {
    const res = await fetch(`${API_BASE}/students?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allStudents = data.students || [];
    const options = '<option value="">-- Chagua Mwanafunzi --</option>' + allStudents.map(s => `<option value="${s.id}">${s.full_name}</option>`).join('');
    ['marks-student', 'report-student-select', 'fee-student'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerHTML = options; });
    const tbody = document.getElementById('students-table-body');
    if (tbody) tbody.innerHTML = allStudents.map((s, i) => `<tr><td>${i+1}</td><td>${s.full_name}</td><td>${s.gender}</td><td>${allClasses.find(c => c.id === s.class_id)?.name || '-'}</td><td>${s.parent_phone || '-'}</td><td><button onclick="deleteStudent(${s.id})" class="btn-red">Futa</button></td></tr>`).join('') || '<tr><td colspan="6">Hakuna wanafunzi.</td></tr>';
}

async function deleteStudent(id) {
    if (!confirm("Futa mwanafunzi?")) return;
    await fetch(`${API_BASE}/students/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    loadStudents();
}

async function loadSubjects() {
    const res = await fetch(`${API_BASE}/academics/subjects?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allSubjects = data.subjects || [];
    const options = '<option value="">-- Chagua Somo --</option>' + allSubjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    ['marks-subject', 'assign-subject'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerHTML = options; });
}

async function loadTeachers() {
    const res = await fetch(`${API_BASE}/teachers?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allTeachers = data.teachers || [];
    const options = '<option value="">-- Chagua Mwalimu --</option>' + allTeachers.map(t => `<option value="${t.id}">${t.full_name}</option>`).join('');
    if(document.getElementById('assign-teacher')) document.getElementById('assign-teacher').innerHTML = options;
    const tbody = document.getElementById('teachers-table-body');
    if (tbody) tbody.innerHTML = allTeachers.map((t, i) => `<tr><td>${i+1}</td><td>${t.full_name}</td><td>${t.phone || '-'}</td><td>${t.gender || '-'}</td></tr>`).join('') || '<tr><td colspan="4">Hakuna walimu.</td></tr>';
    
    const resA = await fetch(`${API_BASE}/teachers/assignments?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const dataA = await resA.json();
    const tbodyA = document.getElementById('assignments-table-body');
    if(tbodyA) tbodyA.innerHTML = (dataA.assignments || []).map(a => `<tr><td>${a.teacher_name}</td><td>${a.class_name}</td><td>${a.subject_name}</td></tr>`).join('') || '<tr><td colspan="3">Hakuna mgawanyo.</td></tr>';
}

async function loadExams() {
    const res = await fetch(`${API_BASE}/exams?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allExams = data.exams || [];
    const options = '<option value="">-- Chagua Mtihani --</option>' + allExams.map(e => `<option value="${e.id}">${e.name} (${e.term})</option>`).join('');
    ['marks-exam', 'process-exam-select', 'report-exam-select'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerHTML = options; });
}

async function loadBroadsheet() {
    const examId = document.getElementById('process-exam-select').value;
    if (!examId) return alert("Chagua mtihani!");
    const res = await fetch(`${API_BASE}/exams/processed/${examId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    currentProcessedData = data; 
    document.getElementById('broadsheet-container').style.display = 'block';
    document.getElementById('broadsheet-title').innerText = `MATOKEO: ${data.exam.name.toUpperCase()} - ${data.exam.term.toUpperCase()}`;
    const tbody = document.getElementById('broadsheet-body');
    tbody.innerHTML = '';
    data.results.forEach(r => {
        tbody.innerHTML += `<tr><td><strong>${r.rank}</strong></td><td>${r.admission_number}</td><td>${r.full_name}</td><td>${r.gender}</td><td>${r.totalMarks}</td><td><strong>${r.aggregatePoints}</strong></td><td>${r.gpa}</td><td><strong>${r.division}</strong></td></tr>`;
    });
}

async function printReportCard() {
    const examId = document.getElementById('report-exam-select').value;
    const studentId = document.getElementById('report-student-select').value;
    if (!examId || !studentId) return alert("Chagua mtihani na mwanafunzi!");
    if (!currentProcessedData || currentProcessedData.exam.id != examId) {
        const res = await fetch(`${API_BASE}/exams/processed/${examId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        currentProcessedData = await res.json();
    }
    const studentResult = currentProcessedData.results.find(r => r.id == studentId);
    if (!studentResult) return alert("Hakuna matokeo kwa mwanafunzi huyu.");
    const exam = currentProcessedData.exam;
    
    const currentSchool = allSchoolsData.find(s => s.id == currentSchoolId);
    const signatureImg = currentSchool && currentSchool.headmaster_signature ? `<img src="${currentSchool.headmaster_signature}" style="height: 60px; max-width: 150px; object-fit: contain;">` : `<p style="margin-top: 40px;">.......................</p>`;
    const stampImg = currentSchool && currentSchool.school_stamp ? `<img src="${currentSchool.school_stamp}" style="height: 80px; max-width: 150px; object-fit: contain;">` : ``;

    const schoolName = currentSchool ? currentSchool.name : "JINA LA SHULE";
    
    let subjectRows = studentResult.subjects.map(s => `<tr><td style="border: 1px solid #000; padding: 5px;">${s.subject_name}</td><td style="border: 1px solid #000; padding: 5px; text-align: center;">${s.marks}</td><td style="border: 1px solid #000; padding: 5px; text-align: center;">${s.grade}</td><td style="border: 1px solid #000; padding: 5px; text-align: center;">${s.points}</td></tr>`).join('');
    
    document.getElementById('printable-report').innerHTML = `
        <div style="padding: 40px; font-family: 'Times New Roman';">
            <div style="text-align: center; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
                <h1 style="margin: 0; text-transform: uppercase;">${schoolName}</h1>
                <h3 style="margin: 5px 0;">RIPOTI YA MATOKEO YA MWANAFUNZI</h3>
                <p style="margin: 0;">Mtihani: ${exam.name} (${exam.term} ${exam.year})</p>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                <div><p><strong>Jina:</strong> ${studentResult.full_name}</p><p><strong>Adm:</strong> ${studentResult.admission_number}</p></div>
                <div><p><strong>Jinsia:</strong> ${studentResult.gender}</p><p><strong>Nafasi:</strong> ${studentResult.rank} kati ya ${currentProcessedData.results.length}</p></div>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead><tr style="background: #e0e0e0;"><th style="border: 1px solid #000; padding: 8px; text-align: left;">Somo</th><th style="border: 1px solid #000; padding: 8px;">Alama</th><th style="border: 1px solid #000; padding: 8px;">Grade</th><th style="border: 1px solid #000; padding: 8px;">Pointi</th></tr></thead>
                <tbody>${subjectRows}</tbody>
            </table>
            <div style="display: flex; justify-content: space-between; border: 2px solid #000; padding: 15px; font-weight: bold; margin-bottom: 50px;">
                <div>Jumla: ${studentResult.totalMarks}</div><div>Pointi: ${studentResult.aggregatePoints}</div><div>GPA: ${studentResult.gpa}</div><div>Div: ${studentResult.division}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 50px;">
                <div style="text-align:center;">
                    <p>Sahihi Mwalimu:</p>
                    <p style="margin-top: 40px;">.......................</p>
                </div>
                <div style="text-align:center;">
                    <p>Sahihi Mkuu:</p>
                    ${signatureImg}
                </div>
                <div style="text-align:center;">
                    <p>Muhuri wa Shule:</p>
                    ${stampImg}
                </div>
            </div>
        </div>`;
    window.print();
}

async function loadFeeStatus() {
    const term = document.getElementById('status-term').value; const year = document.getElementById('status-year').value;
    const res = await fetch(`${API_BASE}/fees/status/${currentSchoolId}?term=${term}&year=${year}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const tbody = document.getElementById('fee-status-body'); tbody.innerHTML = '';
    (data.statusList || []).forEach(s => {
        let color = s.status === 'AMELIPA ZOTE' ? '#d4edda' : (s.status === 'AMELIPA KIDOGO' ? '#fff3cd' : '#f8d7da');
        tbody.innerHTML += `<tr style="background: ${color};"><td>${s.full_name}</td><td>${s.class_name}</td><td>Tsh ${s.requiredAmount.toLocaleString()}</td><td>Tsh ${s.paidAmount.toLocaleString()}</td><td>Tsh ${s.balance.toLocaleString()}</td><td><strong>${s.status}</strong></td></tr>`;
    });
}

async function loadNotifications() {
    const res = await fetch(`${API_BASE}/notifications?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    document.getElementById('notifications-list').innerHTML = (data.notifications || []).map(n => `<div style="background:#fff; padding:10px; margin-bottom:10px; border-left:4px solid #3498db;"><strong>${n.title}</strong><p>${n.message}</p></div>`).join('') || '<p>Hakuna taarifa.</p>';
}

async function loadAttendance() {
    const class_id = document.getElementById('att-class').value; const date = document.getElementById('att-date').value;
    if (!class_id || !date) return alert("Chagua darasa na tarehe!");
    const res = await fetch(`${API_BASE}/students?school_id=${currentSchoolId}&class_id=${class_id}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const tbody = document.getElementById('attendance-table-body'); tbody.innerHTML = '';
    (data.students || []).forEach((s, i) => {
        tbody.innerHTML += `<tr><td>${s.full_name}</td><td><select class="att-status" data-student-id="${s.id}"><option value="PRESENT">Yupo</option><option value="ABSENT">Hayupo</option></select></td></tr>`;
    });
    document.getElementById('attendance-form').style.display = 'block';
}

async function loadUsers() {
    const res = await fetch(`${API_BASE}/users`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const tbody = document.getElementById('users-table-body');
    if(tbody) {
        tbody.innerHTML = data.users.map(u => `<tr><td>${u.full_name}</td><td><strong>${u.username}</strong></td><td>${u.role}</td><td>${u.school_name || 'N/A'}</td></tr>`).join('');
    }
}

function showSection(id) {
    ['students', 'teachers', 'classes', 'attendance', 'exams', 'fees', 'notifications', 'users'].forEach(s => { 
        const el = document.getElementById(`${s}-section`);
        if(el) el.style.display = 'none'; 
    });
    const target = document.getElementById(`${id}-section`);
    if(target) target.style.display = 'block';
    if(!currentSchoolId && id !== 'users') alert("Chagua shule kwanza!");
}