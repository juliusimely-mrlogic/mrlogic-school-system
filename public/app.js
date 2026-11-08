const API_BASE = '/api'; // TUMEBADILISHA HII ILI IFANYE KAZI RENDER
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
    await loadSchools();
}

// 4. Kuvuta Shule
async function loadSchools() {
    try {
        const res = await fetch(`${API_BASE}/schools`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (res.ok && data.schools) {
            schoolSelector.innerHTML = '<option value="">-- Chagua Shule --</option>';
            data.schools.forEach(school => {
                schoolSelector.innerHTML += `<option value="${school.id}">${school.name}</option>`;
            });
        }
    } catch (err) { alert("Server haipatikani."); }
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
            body: JSON.stringify({ code, name, region, district, schoolLevels: ['O_LEVEL', 'A_LEVEL'] }) // Tunasajili O na A kwa mfano
        });
        if (res.ok) {
            alert("Shule imesajiliwa pamoja na masomo yake!");
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
        await loadSubjects(); // Hii inavuta masomo kwa ajili ya dropdowns
        await loadSubjectsUI(); // Hii inavuta masomo kuyaonyesha kwenye jedwali
        await loadFees();
        await loadExams();
        await loadAssignments();
        await loadNotifications();
        updateDashboardStats();
    } else {
        analyticsSection.style.display = 'none';
    }
});

// 8. TAKWIMU
function updateDashboardStats() {
    document.getElementById('stat-students').innerText = allStudents.length;
    document.getElementById('stat-teachers').innerText = allTeachers.length; 
    document.getElementById('stat-classes').innerText = allClasses.length;
    document.getElementById('stat-exams').innerText = allExams.length;
    const totalFees = allFees.reduce((sum, fee) => sum + fee.amount, 0);
    document.getElementById('stat-fees').innerText = 'Tsh ' + totalFees.toLocaleString();
}

// 9. KUVUTA MASOMO (Kwa ajili ya UI)
async function loadSubjectsUI() {
    if (!currentSchoolId) return;
    try {
        const res = await fetch(`${API_BASE}/academics/subjects?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        allSubjects = data.subjects || [];
        
        const tbody = document.getElementById('subjects-table-body');
        tbody.innerHTML = '';
        
        if (allSubjects.length > 0) {
            allSubjects.forEach((s, index) => {
                tbody.innerHTML += `<tr>
                    <td>${index + 1}</td>
                    <td><strong>${s.code}</strong></td>
                    <td>${s.name}</td>
                    <td>${s.level_type}</td>
                    <td>${s.category}</td>
                </tr>`;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Hakuna masomo.</td></tr>';
        }
    } catch (err) { console.error(err); }
}

// 10. Kuvuta Masomo (Kwa ajili ya Dropdown za Mitihani/Mgawanyo)
async function loadSubjects() {
    if (!currentSchoolId) return;
    try {
        const res = await fetch(`${API_BASE}/academics/subjects?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        const subjects = data.subjects || [];
        
        const subjectDropdown = document.getElementById('marks-subject');
        const assignSubjectDropdown = document.getElementById('assign-subject'); 

        if(subjectDropdown) subjectDropdown.innerHTML = '<option value="">-- Chagua Somo --</option>';
        if(assignSubjectDropdown) assignSubjectDropdown.innerHTML = '<option value="">-- Chagua Somo --</option>'; 

        subjects.forEach(s => {
            if(subjectDropdown) subjectDropdown.innerHTML += `<option value="${s.id}">${s.name} (${s.level_type})</option>`;
            if(assignSubjectDropdown) assignSubjectDropdown.innerHTML += `<option value="${s.id}">${s.name}</option>`; 
        });
    } catch (err) { console.error(err); }
}

// 11. Kubadilisha Sehemu (Show Section)
function showSection(section) {
    // Ficha zote
    const sections = ['teachers-section', 'students-section', 'classes-section', 'fees-section', 'attendance-section', 'exams-section', 'notifications-section', 'subjects-section'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });
    
    // Onyesha inayotakiwa
    const target = document.getElementById(`${section}-section`);
    if(target) target.style.display = 'block';

    if (!currentSchoolId) alert("Tafadhali chagua shule juu kwanza ili kuona taarifa.");
}

// (Weka function zingine za loadStudents, loadTeachers, n.k. hapa chini kama ulivyokuwa nazo)