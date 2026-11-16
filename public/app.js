// ==========================================
// 0. DYNAMIC LOGIN ANNOUNCEMENTS & AUTH
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
    
    if (user && user.role === 'super_admin') {
        document.getElementById('nav-kusajili_shule').style.display = 'block';
        document.getElementById('nav-announcements').style.display = 'block';
        document.getElementById('nav-subscription_mgmt').style.display = 'block';
        document.getElementById('nav-my_subscription').style.display = 'none'; 
        document.getElementById('nav-district_dashboard').style.display = 'none';
    } else if (user && user.role === 'district_officer') {
        document.getElementById('nav-district_dashboard').style.display = 'block';
        document.getElementById('nav-kusajili_shule').style.display = 'none';
        document.getElementById('nav-subscription_mgmt').style.display = 'none';
        document.getElementById('nav-my_subscription').style.display = 'none';
        document.getElementById('nav-announcements').style.display = 'none';
    } else {
        document.getElementById('nav-kusajili_shule').style.display = 'none';
        document.getElementById('nav-announcements').style.display = 'none';
        document.getElementById('nav-subscription_mgmt').style.display = 'none';
        document.getElementById('nav-my_subscription').style.display = 'block';
        document.getElementById('nav-district_dashboard').style.display = 'none';
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
// 1. DASHIBODI YA HALMASHAURI (AFISA TAALUMA)
// ==========================================
async function renderDistrictDashboard() {
    content.innerHTML = `<h2>Inapakia Takwimu za Halmashauri...</h2>`;
    
    try {
        const res = await fetch('/api/district/dashboard', { headers: authHeaders });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);

        content.innerHTML = `
            <h2>Dashibodi ya Halmashauri: ${d.district_name}</h2>
            <div class="grid-3">
                <div class="stat-card" style="background:#2563eb;"><h3>JUMLA YA SHULE</h3><p class="val">${d.total_schools}</p></div>
                <div class="stat-card" style="background:#dc2626;"><h3>JUMLA YA WANAFUNZI</h3><p class="val">${d.total_students}</p></div>
                <div class="stat-card" style="background:#9333ea;"><h3>JUMLA YA WALIMU</h3><p class="val">${d.total_teachers}</p></div>
            </div>
            <div class="grid-3">
                <div class="stat-card" style="background:#0ea5e9;"><h3>WANAUME</h3><p class="val">${d.male_students}</p></div>
                <div class="stat-card" style="background:#ec4899;"><h3>WANAWAKE</h3><p class="val">${d.female_students}</p></div>
                <div class="stat-card" style="background:#f59e0b;"><h3>MADARASA</h3><p class="val">${d.total_classes}</p></div>
            </div>

            <div class="card">
                <h3>Ufaulu wa Shule (Mtihani wa Mwisho)</h3>
                <p><strong>Waliofaulu:</strong> <span style="color:green; font-weight:bold;">${d.total_pass}</span> | <strong>Waliofeli:</strong> <span style="color:red; font-weight:bold;">${d.total_fail}</span></p>
            </div>

            <div class="card" style="overflow-x:auto;">
                <h3>Nafasi za Shule kwa GPA (Halmashauri)</h3>
                <table>
                    <thead><tr><th>NAFASI</th><th>SHULE</th><th>NGazi</th><th>GPA</th><th>Waliofaulu</th><th>Waliofeli</th><th>Subscription</th></tr></thead>
                    <tbody>${d.schools.map(s => `<tr><td>${s.rank}</td><td><strong>${s.name}</strong></td><td>${s.level || '-'}</td><td>${s.gpa}</td><td style="color:green;">${s.pass}</td><td style="color:red;">${s.fail}</td><td><span class="badge-${s.subscription_status === 'SUBSCRIPTION_ACTIVE' ? 'active' : 'inactive'}">${s.subscription_status}</span></td></tr>`).join('')}</tbody>
                </table>
            </div>
        `;
    } catch (e) { content.innerHTML = `<h2 style="color:red;">Kosa: ${e.message}</h2>`; }
}

// (Weka function zingine zote za renderDashboard, renderWanafunzi, n.k. chini hapa kama zilivyokuwa kwenye code ya awali)
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('token')) {
        showApp();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-screen').style.display = 'none';
        loadLoginAnnouncements(); 
    }
});