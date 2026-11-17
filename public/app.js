// ==========================================
// 0. AUTH
// ==========================================
async function loadLoginAnnouncements() {
    try {
        const res = await fetch('/api/public/announcements');
        if (!res.ok) throw new Error('Network error');
        const data = await res.json();
        const annBox = document.getElementById('login-announcement');
        if (data.length > 0) {
            document.getElementById('login-ann-sw').textContent = data[0].message_sw;
            document.getElementById('login-ann-en').textContent = data[0].message_en || '';
            annBox.style.display = 'block';
        } else {
            document.getElementById('login-ann-sw').textContent = "Karibu MR-LOGIC School System. Tafadhali ingia kuendelea.";
            document.getElementById('login-ann-en').textContent = "Welcome to MR-LOGIC School System. Please login to continue.";
            annBox.style.display = 'block';
        }
    } catch (error) { console.log("Hakuna matangazo."); }
}
document.addEventListener('DOMContentLoaded', loadLoginAnnouncements);

async function login() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    const msg = document.getElementById('login-msg');
    msg.textContent = "Inapakia...";
    try {
        const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        showApp();
    } catch (err) { msg.textContent = err.message; }
}

function logout() {
    localStorage.clear();
    document.getElementById('app-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
}

async function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';
    const user = JSON.parse(localStorage.getItem('user'));
    
    // Ficha vitufe vyote kwanza
    document.querySelectorAll('.nav-link').forEach(link => link.style.display = 'none');

    // Onyesha vitufe kulingana na role
    if (user.role === 'super_admin') {
        document.getElementById('nav-dashboard').style.display = 'block';
        document.getElementById('nav-directory').style.display = 'block'; // Kitufe kipya
        document.getElementById('nav-kusajili_shule').style.display = 'block';
        document.getElementById('nav-announcements').style.display = 'block';
        document.getElementById('nav-subscription_mgmt').style.display = 'block';
        document.getElementById('nav-ada').style.display = 'block';
        document.getElementById('nav-alama').style.display = 'block';
        document.getElementById('nav-broadsheet').style.display = 'block';
        document.getElementById('nav-mahudhurio').style.display = 'block';
        document.getElementById('nav-kupanga').style.display = 'block';
        document.getElementById('nav-ripoti').style.display = 'block';
        document.getElementById('nav-nafasi_shule').style.display = 'block';
        document.getElementById('nav-mipangilio').style.display = 'block';
    } else if (user.role === 'district_officer') {
        document.getElementById('nav-district_dashboard').style.display = 'block';
        document.getElementById('nav-dashboard').style.display = 'block';
    } else {
        document.getElementById('nav-dashboard').style.display = 'block';
        document.getElementById('nav-my_subscription').style.display = 'block';
        document.getElementById('nav-wanafunzi').style.display = 'block';
        document.getElementById('nav-walimu').style.display = 'block';
        document.getElementById('nav-ada').style.display = 'block';
        document.getElementById('nav-alama').style.display = 'block';
        document.getElementById('nav-broadsheet').style.display = 'block';
        document.getElementById('nav-mahudhurio').style.display = 'block';
        document.getElementById('nav-kupanga').style.display = 'block';
        document.getElementById('nav-ripoti').style.display = 'block';
        document.getElementById('nav-nafasi_shule').style.display = 'block';
        document.getElementById('nav-mipangilio').style.display = 'block';
    }
    
    if (user.role === 'district_officer') navigate('district_dashboard');
    else navigate('dashboard');
}

const token = localStorage.getItem('token');
const authHeaders = { 'Authorization': `Bearer ${token}` };
const content = document.getElementById('content-area');

function navigate(page) {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const navEl = document.getElementById('nav-' + page);
    if (navEl) navEl.classList.add('active');

    if (page === 'dashboard') renderDashboard();
    else if (page === 'directory') renderDirectory();
    else if (page === 'district_dashboard') renderDistrictDashboard();
    else if (page === 'kusajili_shule') renderKusajiliShule();
    else if (page === 'subscription_mgmt') renderSubscriptionMgmt();
    else if (page === 'my_subscription') renderMySubscription();
    else if (page === 'announcements') renderAnnouncements();
    else if (page === 'wanafunzi') renderWanafunzi();
    else if (page === 'walimu') renderWalimu();
    else if (page === 'ada') renderAda();
    else if (page === 'alama') renderAlama();
    else if (page === 'broadsheet') renderBroadsheet();
    else if (page === 'mahudhurio') renderMahudhurio();
    else if (page === 'kupanga') renderKupanga();
    else if (page === 'ripoti') renderRipoti();
    else if (page === 'nafasi_shule') renderNafasiShule();
    else if (page === 'mipangilio') renderMipangilio();
}

// ==========================================
// SCHOOL & COUNCIL DIRECTORY
// ==========================================
async function renderDirectory() {
    content.innerHTML = `<h2>Inapakia Orodha ya Shule na Halmashauri...</h2>`;
    
    try {
        const summaryRes = await fetch('/api/directory/summary', { headers: authHeaders });
        const summary = await summaryRes.json();
        if (!summaryRes.ok) throw new Error(summary.error);

        let councilOptions = `<option value="all">-- Halmashauri Zote --</option>`;
        summary.forEach(item => {
            councilOptions += `<option value="${item.council}">${item.council} (${item.total_schools} Shule)</option>`;
        });

        content.innerHTML = `
            <div class="card">
                <h3>Chagua Halmashauri</h3>
                <select id="council-selector" onchange="loadDirectorySchools(this.value)" style="padding:10px; border-radius:5px; width:100%; max-width:400px;">
                    ${councilOptions}
                </select>
            </div>
            <div class="card" style="overflow-x:auto;">
                <h3>Orodha ya Shule</h3>
                <table>
                    <thead>
                        <tr>
                            <th>S/N</th>
                            <th>JINA LA SHULE</th>
                            <th>HALMASHAURI</th>
                            <th>IDADI YA WANAFUNZI</th>
                            <th>MKUU WA SHULE</th>
                            <th>AFISA TAALUMA</th>
                            <th>AFISA ELIMU</th>
                        </tr>
                    </thead>
                    <tbody id="directory-table-body">
                        <tr><td colspan="7" style="text-align:center;">Inapakia...</td></tr>
                    </tbody>
                </table>
            </div>
        `;

        loadDirectorySchools('all');

    } catch (error) {
        content.innerHTML = `<h2 style="color:red;">Kosa: ${error.message}</h2>`;
    }
}

async function loadDirectorySchools(council) {
    const tbody = document.getElementById('directory-table-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Inapakia...</td></tr>`;

    try {
        const url = council === 'all' ? '/api/directory/schools' : `/api/directory/schools?council=${encodeURIComponent(council)}`;
        const res = await fetch(url, { headers: authHeaders });
        const schools = await res.json();
        if (!res.ok) throw new Error(schools.error);

        tbody.innerHTML = '';
        if (schools.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Hakuna shule zilizosajiliwa.</td></tr>`;
            return;
        }

        schools.forEach((school, index) => {
            tbody.innerHTML += `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${school.name}</strong></td>
                    <td>${school.council || 'Hakuna'}</td>
                    <td>${school.total_students}</td>
                    <td>${school.head_of_school || '-'}</td>
                    <td>${school.academic_officer || '-'}</td>
                    <td>${school.education_officer || '-'}</td>
                </tr>
            `;
        });

    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">Kosa: ${error.message}</td></tr>`;
    }
}

// (Weka function zingine zote za renderDashboard, renderWanafunzi, n.k. chini hapa)
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('token')) {
        showApp();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-screen').style.display = 'none';
        loadLoginAnnouncements(); 
    }
});