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
                } else { document.getElementById('login-error').innerText = data.error; }
            } catch (err) { document.getElementById('login-error').innerText = 'Server haipatikani au imelala.'; } 
            finally { btn.innerText = 'Ingia Mfumoni'; }
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) logoutBtn.addEventListener('click', () => { localStorage.clear(); location.reload(); });

    if (token) { showDashboard(); }

    // 2. KUFUNGUA KADI
    const menuCards = document.getElementById('menu-cards');
    if (menuCards) {
        menuCards.addEventListener('click', (e) => {
            const card = e.target.closest('.card');
            if (card && card.dataset.section) {
                showSection(card.dataset.section);
            }
        });
    }

    // 3. FOMU YA MTUMIAJI (Kuvuta Walimu)
    const userSchoolSelect = document.getElementById('user-school');
    if(userSchoolSelect) {
        userSchoolSelect.addEventListener('change', async (e) => {
            const selectedSchool = e.target.value;
            if (!selectedSchool) return;
            try {
                const res = await fetch(`${API_BASE}/teachers?school_id=${selectedSchool}`, { headers: { 'Authorization': `Bearer ${token}` } });
                const data = await res.json();
                const teachers = data.teachers || [];
                const options = '<option value="">-- Chagua Mwalimu --</option>' + teachers.map(t => `<option value="${t.id}">${t.full_name}</option>`).join('');
                if(document.getElementById('user-teacher')) document.getElementById('user-teacher').innerHTML = options;
            } catch (err) { console.error(err); }
        });
    }

    const userRoleSelect = document.getElementById('user-role');
    if(userRoleSelect) {
        userRoleSelect.addEventListener('change', (e) => {
            const teacherSelect = document.getElementById('user-teacher');
            if(teacherSelect) {
                if(e.target.value === 'TEACHER') { teacherSelect.style.display = 'block'; teacherSelect.required = true; }
                else { teacherSelect.style.display = 'none'; teacherSelect.required = false; teacherSelect.value = ''; }
            }
        });
    }

    // 4. FOMU ZOTE ZA KAZI (Nakili functions zilizobaki hapa kama zilivyo kwenye code ya awali)
    // ... [Weka event listeners zote za bulk, assets, school, user, class, student, teacher, assignment, exam, marks, fee, mobile, notification, attendance]
});

window.showSection = function(id) {
    const sections = ['students', 'teachers', 'classes', 'attendance', 'exams', 'fees', 'notifications', 'users'];
    sections.forEach(s => { 
        const el = document.getElementById(`${s}-section`);
        if(el) el.style.display = 'none'; 
    });
    
    const target = document.getElementById(`${id}-section`);
    if(target) target.style.display = 'block';
    
    if(!currentSchoolId && id !== 'users') alert("Tafadhali chagua shule juu kwanza!");
};

function applyRBAC() {
    const show = (id) => { const el = document.getElementById(id); if(el) el.style.display = 'block'; };
    const hide = (id) => { const el = document.getElementById(id); if(el) el.style.display = 'none'; };
    
    if (currentUserRole === 'SUPER_ADMIN') {
        show('superadmin-dashboard');
        hide('schooladmin-dashboard');
        show('admin-school-actions');
        show('card-fees');
        show('card-users');
        show('add-student-container');
        show('bulk-upload-container');
        show('add-class-container');
        show('add-exam-container');
        fetchSuperAdminStats();
    } 
    else if (currentUserRole === 'SCHOOL_MANAGER' || currentUserRole === 'ACADEMIC_HEAD') {
        hide('superadmin-dashboard');
        show('schooladmin-dashboard');
        hide('admin-school-actions'); 
        show('card-fees'); 
        show('card-users'); 
        show('add-student-container');
        show('bulk-upload-container');
        show('add-class-container');
        show('add-exam-container');
        if(currentSchoolId) fetchSchoolAdminStats(currentSchoolId);
    } 
    else if (currentUserRole === 'TEACHER') {
        hide('superadmin-dashboard');
        hide('schooladmin-dashboard');
        hide('admin-school-actions'); 
        hide('card-fees'); 
        hide('card-users'); 
        hide('add-student-container'); 
        hide('bulk-upload-container'); 
        hide('add-class-container');
        hide('add-exam-container');
    }
}

function showDashboard() {
    document.getElementById('welcome-msg').innerText = `Karibu, ${localStorage.getItem('user_name')}`;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard-screen').style.display = 'block';
    applyRBAC(); 
    loadSchools();
}

// TAKWIMU ZA SHULE (MPYA)
async function fetchSchoolAdminStats(schoolId) {
    try {
        const res = await fetch(`${API_BASE}/schools/${schoolId}/stats`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if(res.ok) {
            document.getElementById('sch-students').innerText = data.totalStudents;
            document.getElementById('sch-teachers').innerText = data.totalTeachers;
            document.getElementById('sch-classes').innerText = data.totalClasses;
            document.getElementById('sch-fees').innerText = 'Tsh ' + data.totalFees.toLocaleString();
        }
    } catch(err) { console.error(err); }
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
    if (!confirm("Una uhakika unataka kufuta shule ZOTE?")) return;
    try {
        const res = await fetch(`${API_BASE}/schools/clear-all`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) { alert("Shule zote zimefutwa!"); loadSchools(); } 
        else { const data = await res.json(); alert("Kosa: " + data.error); }
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
        
        // Sasisha takwimu za shule kama ni mkuu wa shule
        if (currentUserRole === 'SCHOOL_MANAGER' || currentUserRole === 'ACADEMIC_HEAD') {
            fetchSchoolAdminStats(currentSchoolId);
        }
    }
});

// (Nakili functions zingine zote hapa: loadClasses, deleteClass, loadStudents, deleteStudent, loadSubjects, loadTeachers, loadExams, loadBroadsheet, printReportCard, loadFeeStatus, loadNotifications, loadAttendance, loadUsers)
// [Weka functions hizo zote hapa chini kutoka kwenye code ya awali]