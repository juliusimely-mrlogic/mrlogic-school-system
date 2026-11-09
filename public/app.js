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

            // Kama ni mara ya kwanza (password = 1000), mpe nafasi ya kubadilisha
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
    
    // Ficha kadi za shule kama mtumiaji si Super Admin
    if (currentUserRole !== 'SUPER_ADMIN') {
        document.getElementById('add-school-btn').style.display = 'none';
        // Kama ni Mkuu wa shule, mpe currentSchoolId ya shule yake (tutaleta kwenye fetch schools)
    }

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
        
        // Kama ni School Manager, chagua shule yake moja kwa moja
        if (currentUserRole !== 'SUPER_ADMIN' && data.schools.length > 0) {
            sel.value = data.schools[0].id;
            sel.dispatchEvent(new Event('change'));
            sel.disabled = true; // Hataweza kubadilisha shule
        }
    }
}

// 3. WATUMIAJI (USERS)
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

    // Kama ni Super Admin ndio anaweza kuchagua shule. Kama ni Mkuu wa shule, mfumo unajua shule yake.
    if (currentUserRole !== 'SUPER_ADMIN') {
        body.school_id = null; // Itatumika school_id ya manager kwenye backend
    } else {
        // Kama Super admin, chukua shule aliyoichagua kwenye dropdown kuu
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

// (Weka code zilizobaki za Madarasa, Wanafunzi, Mitihani, Ada hapa kama zilivyokuwa Awamu 6)
// ... [Nakili function zote za loadClasses, loadStudents, n.k. kutoka ujumbe uliopita] ...

// 4. MABADILIKO YA SHULE
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

function showSection(id) {
    ['students', 'classes', 'exams', 'fees', 'users'].forEach(s => {
        const el = document.getElementById(`${s}-section`);
        if(el) el.style.display = 'none';
    });
    const target = document.getElementById(`${id}-section`);
    if(target) target.style.display = 'block';
    if(!currentSchoolId && id !== 'users') alert("Chagua shule kwanza!");
}