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
            } catch (err) { document.getElementById('login-error').innerText = 'Server haipatikani.'; } 
            finally { btn.innerText = 'Ingia Mfumoni'; }
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) logoutBtn.addEventListener('click', () => { localStorage.clear(); location.reload(); });

    if (token) { showDashboard(); }

    // ... (Fomu zingine zote zipo hapa chini kama zilivyokuwa)
    setupForms();
});

function applyRBAC() {
    // Ficha vitu kulingana na role
    if (currentUserRole === 'SUPER_ADMIN') {
        document.getElementById('superadmin-dashboard').style.display = 'block';
        document.getElementById('admin-school-actions').style.display = 'block';
        document.getElementById('card-fees').style.display = 'block';
        document.getElementById('card-users').style.display = 'block';
        fetchSuperAdminStats();
    } 
    else if (currentUserRole === 'SCHOOL_MANAGER' || currentUserRole === 'ACADEMIC_HEAD') {
        document.getElementById('admin-school-actions').style.display = 'none'; // Hawawezi kusajili shule mpya
        document.getElementById('card-fees').style.display = 'block'; // Wanaona fedha
        document.getElementById('card-users').style.display = 'block'; // Wanaweza kusajili walimu
    } 
    else if (currentUserRole === 'TEACHER') {
        document.getElementById('admin-school-actions').style.display = 'none'; 
        document.getElementById('card-fees').style.display = 'none'; // Mwalimu HAONI fedha
        document.getElementById('card-users').style.display = 'none'; // Mwalimu HAONI watumiaji
    }
}

function showDashboard() {
    document.getElementById('welcome-msg').innerText = `Karibu, ${localStorage.getItem('user_name')}`;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard-screen').style.display = 'block';
    
    applyRBAC(); // Fanya ulinzi hapa
    loadSchools();
}

// (Weka functions zingine zote hapa: fetchSuperAdminStats, loadSchools, loadStudents, printReportCard, n.k. kama zilivyokuwa)
// [Nakili code zote za functions kutoka kwenye ujumbe uliopita na uziweke hapa]