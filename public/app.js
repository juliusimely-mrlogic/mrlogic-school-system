const API_BASE = '/api'; 
let token = localStorage.getItem('token');
let currentSchoolId = null;
let currentUserRole = localStorage.getItem('user_role');
let allSchoolsData = []; // Hifadhi data zote za shule

document.addEventListener('DOMContentLoaded', () => {
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

    // MPYA: Fomu ya kupakia sahihi na muhuri
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

            // Kazi ya kubadilisha picha kuwa Base64 string
            const toBase64 = file => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });

            try {
                let sigBase64 = null;
                let stampBase64 = null;

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
                    loadSchools(); // Sasisha data ya shule
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

document.getElementById('school-selector').addEventListener('change', async (e) => {
    currentSchoolId = e.target.value;
    if (currentSchoolId) {
        await loadClasses(); 
        await loadStudents(); 
    }
});

async function loadClasses() {
    const res = await fetch(`${API_BASE}/classes?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const classes = data.classes || [];
    const options = '<option value="">-- Chagua Darasa --</option>' + classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    ['student-class', 'bulk-class'].forEach(id => { 
        if(document.getElementById(id)) document.getElementById(id).innerHTML = options; 
    });
    const tbody = document.getElementById('classes-table-body');
    if (tbody) tbody.innerHTML = classes.map((c, i) => `<tr><td>${i+1}</td><td>${c.name}</td><td>${c.level_type}</td></tr>`).join('') || '<tr><td colspan="3">Hakuna madarasa.</td></tr>';
}

async function loadStudents() {
    const res = await fetch(`${API_BASE}/students?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const tbody = document.getElementById('students-table-body');
    if(tbody) {
        tbody.innerHTML = (data.students || []).map((s, i) => `<tr><td>${i+1}</td><td>${s.full_name}</td><td>${s.gender}</td><td>${s.admission_number}</td></tr>`).join('') || '<tr><td colspan="4">Hakuna wanafunzi.</td></tr>';
    }
}

// MPYA: Ripoti ya Mwanafunzi sasa inaingiza Sahihi na Muhuri
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
    
    // Tafuta taarifa za shule (kwa ajili ya picha)
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

function showSection(id) {
    ['students', 'teachers', 'classes', 'attendance', 'exams', 'fees', 'notifications', 'users'].forEach(s => { 
        const el = document.getElementById(`${s}-section`);
        if(el) el.style.display = 'none'; 
    });
    const target = document.getElementById(`${id}-section`);
    if(target) target.style.display = 'block';
    if(!currentSchoolId && id !== 'users') alert("Chagua shule kwanza!");
}