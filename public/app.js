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
// 1. DASHIBODI YA SHULE (NA CHAGUO LA SHULE KWA SUPER ADMIN)
// ==========================================
async function renderDashboard(selectedSchoolId = null) {
    content.innerHTML = `<h2>Inapakia Takwimu...</h2>`;
    const user = JSON.parse(localStorage.getItem('user'));
    let schoolSelectorHtml = '';
    let targetSchoolQuery = '';

    if (user && user.role === 'super_admin') {
        const resS = await fetch('/api/schools', { headers: authHeaders });
        const schools = await resS.json();
        
        let currentSelectedId = selectedSchoolId;
        if (!currentSelectedId) {
            const dropdown = document.getElementById('school-selector');
            if (dropdown) currentSelectedId = dropdown.value;
        }
        if (!currentSelectedId && schools.length > 0) currentSelectedId = schools[0].id;
        
        if (currentSelectedId) targetSchoolQuery = `?school_id=${currentSelectedId}`;

        schoolSelectorHtml = `
            <div style="margin-bottom: 20px; background: #fff; padding: 15px; border-radius: 8px; display: inline-block;">
                <label style="font-weight:bold; margin-right:10px;">Chagua Shule:</label>
                <select id="school-selector" onchange="renderDashboard(this.value)" style="padding:10px; border-radius:5px;">
                    ${schools.map(s => `<option value="${s.id}" ${String(s.id) === String(currentSelectedId) ? 'selected' : ''}>${s.name}</option>`).join('')}
                </select>
            </div>
        `;
    }

    try {
        const res = await fetch('/api/dashboard/stats' + targetSchoolQuery, { headers: authHeaders });
        const d = await res.json();
        
        content.innerHTML = `
            ${schoolSelectorHtml}
            <h2>Takwimu za ${d.schoolName}</h2>
            <div class="grid-3">
                <div class="stat-card" style="background:#2563eb;"><h3>WANAFUNZI</h3><p class="val">${d.totalStudents}</p></div>
                <div class="stat-card" style="background:#dc2626;"><h3>WALIMU</h3><p class="val">${d.totalTeachers}</p></div>
                <div class="stat-card" style="background:#9333ea;"><h3>MADARASA</h3><p class="val">${d.totalClasses}</p></div>
            </div>
            <div class="grid-3">
                <div class="stat-card" style="background:#ea580c;"><h3>MAKADIRIO YA ADA</h3><p class="val">Tsh ${parseInt(d.totalExpectedFees).toLocaleString()}</p></div>
                <div class="stat-card" style="background:#16a34a;"><h3>ADA ILIYOKUSANYWA</h3><p class="val">Tsh ${parseInt(d.totalCollectedFees).toLocaleString()}</p></div>
                <div class="stat-card" style="background:#dc2626;"><h3>MADENI</h3><p class="val">Tsh ${parseInt(d.totalOutstandingFees).toLocaleString()}</p></div>
            </div>
            <div class="grid-charts">
                <div class="chart-box"><canvas id="feesChart"></canvas></div>
                <div class="chart-box"><canvas id="genderChart"></canvas></div>
            </div>
        `;

        new Chart(document.getElementById('feesChart'), { type: 'bar', data: { labels: ['Makadirio', 'Iliyokusanywa', 'Deni'], datasets: [{ data: [d.totalExpectedFees, d.totalCollectedFees, d.totalOutstandingFees], backgroundColor: ['#f97316', '#22c55e', '#ef4444'] }] }, options: { plugins: { title: { display: true, text: 'Mchanganuo wa Fedha' } } } });
        new Chart(document.getElementById('genderChart'), { type: 'doughnut', data: { labels: ['Me', 'Ke'], datasets: [{ data: [d.overallGender.M, d.overallGender.F], backgroundColor: ['#0ea5e9', '#ec4899'] }] }, options: { plugins: { title: { display: true, text: 'Jumla ya Jinsia' } } } });
    } catch (e) { content.innerHTML = `<h2 style="color:red;">Kosa: ${e.message}</h2>`; }
}

// (Weka function zingine zote za renderDistrictDashboard, renderWanafunzi, n.k. hapa chini kama zilivyokuwa kwenye code ya awali)
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('token')) {
        showApp();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-screen').style.display = 'none';
        loadLoginAnnouncements(); 
    }
});