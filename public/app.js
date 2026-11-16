// ==========================================
// 0. DYNAMIC LOGIN ANNOUNCEMENTS
// ==========================================
async function loadLoginAnnouncements() {
    try {
        const res = await fetch('/api/public/announcements');
        if (!res.ok) throw new Error('Network error');
        const data = await res.json();
        
        const annBox = document.getElementById('login-announcement');
        const annSw = document.getElementById('login-ann-sw');
        const annEn = document.getElementById('login-ann-en');

        if (data.length > 0) {
            annSw.textContent = data[0].message_sw;
            annEn.textContent = data[0].message_en || '';
            annBox.style.display = 'block';
        } else {
            // Default Message
            annSw.textContent = "Karibu MR-LOGIC School System. Tafadhali ingia kuendelea.";
            annEn.textContent = "Welcome to MR-LOGIC School System. Please login to continue.";
            annBox.style.display = 'block';
        }
    } catch (error) {
        // Fallback default message on error
        document.getElementById('login-ann-sw').textContent = "Karibu MR-LOGIC School System.";
        document.getElementById('login-ann-en').textContent = "Welcome to MR-LOGIC School System.";
        document.getElementById('login-announcement').style.display = 'block';
    }
}

// Load announcements on page load
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
    } else {
        document.getElementById('nav-kusajili_shule').style.display = 'none';
        document.getElementById('nav-announcements').style.display = 'none';
    }

    // Fetch Role-Specific Announcements after login
    try {
        const res = await fetch('/api/my-announcements', { headers: authHeaders });
        if (res.ok) {
            const anns = await res.json();
            // Kama kuna tangazo maalum kwa role hii, lionyeshe kama alert
            const roleSpecific = anns.filter(a => a.target_role !== 'all'); 
            if (roleSpecific.length > 0) {
                alert(`TAARIFA MUHIMU:\n\n${roleSpecific[0].message_sw}\n\n${roleSpecific[0].message_en || ''}`);
            }
        }
    } catch(e) { console.log("Hakuna matangazo maalum."); }

    navigate('dashboard');
}

const token = localStorage.getItem('token');
const authHeaders = { 'Authorization': `Bearer ${token}` };
const content = document.getElementById('content-area');

function navigate(page) {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const navEl = document.getElementById('nav-' + page);
    if (navEl) navEl.classList.add('active');

    if (page === 'dashboard') renderDashboard();
    else if (page === 'kusajili_shule') renderKusajiliShule();
    else if (page === 'announcements') renderAnnouncements();
    else if (page === 'wanafunzi') renderWanafunzi();
    else if (page === 'walimu') renderWalimu();
    else if (page === 'ada') renderAda();
    else if (page === 'alama') renderAlama();
    else if (page === 'broadsheet') renderBroadsheet();
    else if (page === 'mahudhurio') renderMahudhurio();
    else if (page === 'kupanga') renderKupanga();
    else if (page === 'ripoti') renderRipoti();
    else if (page === 'mipangilio') renderMipangilio();
}

// ==========================================
// 1. DASHBOARD (Na Login Management UI)
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
                <label style="font-weight:bold; margin-right:10px;">Chagua Shule (Kwa Takwimu za Chini):</label>
                <select id="school-selector" onchange="renderDashboard(this.value)" style="padding:10px; border-radius:5px;">
                    ${schools.map(s => `<option value="${s.id}" ${String(s.id) === String(currentSelectedId) ? 'selected' : ''}>${s.name}</option>`).join('')}
                </select>
            </div>
        `;
    }

    try {
        const res = await fetch('/api/dashboard/stats' + targetSchoolQuery, { headers: authHeaders });
        const d = await res.json();
        
        let superAdminHtml = '';
        if (user && user.role === 'super_admin') {
            try {
                const distRes = await fetch('/api/super-admin/district-stats', { headers: authHeaders });
                if (distRes.ok) {
                    const districts = await distRes.json();
                    superAdminHtml += `
                        <h2 style="margin-top:40px; color:#1e3a8a;">Takwimu za Halmashauri Zote</h2>
                        <div class="district-container">
                            ${districts.map(dist => `
                                <div class="district-card">
                                    <div class="district-header">
                                        <h3>Halmashauri ya ${dist.district}</h3>
                                        <p>Shule: <strong>${dist.totalSchools}</strong> | Wanafunzi: <strong>${dist.totalStudents}</strong></p>
                                    </div>
                                    <ul class="school-list">
                                        ${dist.schools.map(sch => `
                                            <li class="school-item">
                                                <span class="school-name">${sch.name}</span>
                                                <span class="school-students">${sch.studentCount} wanafunzi</span>
                                            </li>
                                        `).join('')}
                                    </ul>
                                </div>
                            `).join('')}
                        </div>
                    `;
                }
            } catch (e) { console.error(e); }

            try {
                const payRes = await fetch('/api/super-admin/system-payments', { headers: authHeaders });
                if (payRes.ok) {
                    const pd = await payRes.json();
                    superAdminHtml += `
                        <h2 style="margin-top:40px; color:#1e3a8a;">Kadi ya Malipo ya Mfumo</h2>
                        <div class="grid-3">
                            <div class="stat-card" style="background:#3b82f6;"><h3>MAKADIRIO YA MAKUSANYO</h3><p class="val">Tsh ${parseInt(pd.totalExpected).toLocaleString()}</p></div>
                            <div class="stat-card" style="background:#16a34a;"><h3>ILIYOKUSANYWA</h3><p class="val">Tsh ${parseInt(pd.totalCollected).toLocaleString()}</p></div>
                            <div class="stat-card" style="background:#dc2626;"><h3>MADENI</h3><p class="val">Tsh ${parseInt(pd.totalOutstanding).toLocaleString()}</p></div>
                        </div>
                        <div class="payment-grid">
                            <div class="payment-box">
                                <h4 style="color:#16a34a;">Shule Zilizolipia (${pd.paidSchools.length})</h4>
                                <ul class="list-group">
                                    ${pd.paidSchools.map(sch => `
                                        <li class="list-item">
                                            <span><strong>${sch.name}</strong> <br><small style="color:#6b7280;">${sch.district || 'Hakuna Halmashauri'}</small></span>
                                            <div>
                                                <span class="badge-paid">Tsh ${parseInt(sch.system_fee).toLocaleString()}</span>
                                                <button class="btn-sm" style="background:#dc2626; margin-left:5px;" onclick="togglePayment(${sch.id})">Badilisha</button>
                                            </div>
                                        </li>
                                    `).join('')}
                                    ${pd.paidSchools.length === 0 ? '<p style="text-align:center; color:#6b7280;">Hakuna shule iliyolipia bado.</p>' : ''}
                                </ul>
                            </div>
                            <div class="payment-box">
                                <h4 style="color:#dc2626;">Shule Hazijalipia (${pd.unpaidSchools.length})</h4>
                                <ul class="list-group">
                                    ${pd.unpaidSchools.map(sch => `
                                        <li class="list-item">
                                            <span><strong>${sch.name}</strong> <br><small style="color:#6b7280;">${sch.district || 'Hakuna Halmashauri'}</small></span>
                                            <div>
                                                <span class="badge-unpaid">Tsh ${parseInt(sch.system_fee).toLocaleString()}</span>
                                                <button class="btn-sm" style="background:#16a34a; margin-left:5px;" onclick="togglePayment(${sch.id})">Weka Amelipa</button>
                                            </div>
                                        </li>
                                    `).join('')}
                                    ${pd.unpaidSchools.length === 0 ? '<p style="text-align:center; color:#6b7280;">Shule zote zimelipia!</p>' : ''}
                                </ul>
                            </div>
                        </div>
                    `;
                }
            } catch (e) { console.error(e); }
        }

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
            <div class="card">
                <h3>Nafasi ya Shule (Halmashauri)</h3>
                <h1 style="font-size:48px; color:#1e3a8a; margin:0;">${d.districtRank || '-'}</h1>
                <p>Kati ya shule ${d.totalSchoolsInDistrict || 0}</p>
            </div>
            <div class="grid-charts">
                <div class="chart-box"><canvas id="feesChart"></canvas></div>
                <div class="chart-box"><canvas id="genderChart"></canvas></div>
            </div>
            
            ${superAdminHtml}
        `;

        new Chart(document.getElementById('feesChart'), { type: 'bar', data: { labels: ['Makadirio', 'Iliyokusanywa', 'Deni'], datasets: [{ data: [d.totalExpectedFees, d.totalCollectedFees, d.totalOutstandingFees], backgroundColor: ['#f97316', '#22c55e', '#ef4444'] }] }, options: { plugins: { title: { display: true, text: 'Mchanganuo wa Fedha' } } } });
        new Chart(document.getElementById('genderChart'), { type: 'doughnut', data: { labels: ['Me', 'Ke'], datasets: [{ data: [d.overallGender.M, d.overallGender.F], backgroundColor: ['#0ea5e9', '#ec4899'] }] }, options: { plugins: { title: { display: true, text: 'Jumla ya Jinsia' } } } });

    } catch (e) { content.innerHTML = `<h2 style="color:red;">Kosa: ${e.message}</h2>`; }
}

async function togglePayment(schoolId) {
    if(!confirm('Je, una uhakika unataka kubadilisha hali ya malipo ya shule hii?')) return;
    try {
        const res = await fetch(`/api/super-admin/toggle-payment/${schoolId}`, { method: 'PUT', headers: authHeaders });
        if(!res.ok) throw new Error("Imeshindikana");
        renderDashboard();
    } catch (error) { alert(error.message); }
}

// ==========================================
// 2. KUSAJILI SHULE & ANNOUNCEMENTS
// ==========================================
async function renderKusajiliShule() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'super_admin') {
        content.innerHTML = `<h2 style="color:red;">Hauna ruhusa kufikia ukurasa huu.</h2>`;
        return;
    }

    content.innerHTML = `<h2>Inapakia...</h2>`;
    const res = await fetch('/api/schools', { headers: authHeaders });
    const schools = await res.json();

    content.innerHTML = `
        <div class="card">
            <h3>Kadi ya Kusajili Shule Mpya</h3>
            <form onsubmit="event.preventDefault(); addSchool();">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Jina la Shule:</label>
                        <input type="text" id="sch_name" required placeholder="Mfano: Nyang'homango Secondary">
                    </div>
                    <div class="form-group">
                        <label>Namba ya Mtihani (Centre Number):</label>
                        <input type="text" id="sch_center" required placeholder="Mfano: S0513">
                    </div>
                    <div class="form-group">
                        <label>Mkoa (Region):</label>
                        <input type="text" id="sch_region" required placeholder="Mfano: Mara">
                    </div>
                    <div class="form-group">
                        <label>Halmashauri (District):</label>
                        <input type="text" id="sch_district" required placeholder="Mfano: Bunda">
                    </div>
                    <div class="form-group">
                        <label>Ngazi (Level):</label>
                        <select id="sch_level" required>
                            <option value="">Chagua Ngazi</option>
                            <option value="Primary">Primary (Msingi)</option>
                            <option value="O-Level">O-Level (Sekondari O-Level)</option>
                            <option value="Advanced Level">Advanced Level (Sekondari A-Level)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Jina la School Supervisor:</label>
                        <input type="text" id="sch_supervisor" required placeholder="Jina Kamili">
                    </div>
                    <div class="form-group">
                        <label>Makamu Mkuu wa Shule:</label>
                        <input type="text" id="sch_second_master" required placeholder="Jina Kamili">
                    </div>
                    <div class="form-group">
                        <label>Mtaaluma Mkuu wa Shule:</label>
                        <input type="text" id="sch_academic_master" required placeholder="Jina Kamili">
                    </div>
                    <div class="form-group">
                        <label>Meneja wa Shule (Kama ni ya Binafsi):</label>
                        <input type="text" id="sch_manager" placeholder="Jina la Meneja">
                    </div>
                </div>
                <button type="submit" class="btn-primary" style="margin-top:15px; width:100%;">Sajili Shule</button>
            </form>
        </div>

        <div class="card" style="overflow-x:auto;">
            <h3>Orodha ya Shule Zilizosajiliwa (${schools.length})</h3>
            <table>
                <thead><tr><th>Jina la Shule</th><th>Ngazi</th><th>Mkoa</th><th>Halmashauri</th><th>Centre No.</th><th>Supervisor</th></tr></thead>
                <tbody>${schools.map(s => `<tr><td><strong>${s.name}</strong></td><td>${s.level || '-'}</td><td>${s.region || '-'}</td><td>${s.district || '-'}</td><td>${s.center_number || '-'}</td><td>${s.supervisor || '-'}</td></tr>`).join('')}</tbody>
            </table>
        </div>
    `;
}

async function addSchool() {
    const payload = {
        name: document.getElementById('sch_name').value,
        center_number: document.getElementById('sch_center').value,
        region: document.getElementById('sch_region').value,
        district: document.getElementById('sch_district').value,
        level: document.getElementById('sch_level').value,
        supervisor: document.getElementById('sch_supervisor').value,
        second_master: document.getElementById('sch_second_master').value,
        academic_master: document.getElementById('sch_academic_master').value,
        manager: document.getElementById('sch_manager').value || null
    };
    try {
        const res = await fetch('/api/schools', { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Imeshindikana kusajili");
        alert("Shule imesajiliwa kikamilifu!");
        renderKusajiliShule();
    } catch (error) { alert(error.message); }
}

// ==========================================
// ANNOUNCEMENTS MANAGEMENT (LOGIN PAGE)
// ==========================================
async function renderAnnouncements() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'super_admin') return;

    content.innerHTML = `<h2>Inapakia Matangazo...</h2>`;
    const res = await fetch('/api/admin/announcements', { headers: authHeaders });
    const anns = await res.json();

    content.innerHTML = `
        <div class="card">
            <h3>Ongeza Tangazo Jipya la Ukurasa wa Kuingia</h3>
            <form onsubmit="event.preventDefault(); addAnnouncement();">
                <div class="form-grid">
                    <div class="form-group">
                        <label>Ujumbe kwa Kiswahili (Swahili):</label>
                        <textarea id="ann_sw" required placeholder="Mfano: Karibu kwenye mfumo mpya wa shule..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>Ujumbe kwa Kiingereza (English):</label>
                        <textarea id="ann_en" placeholder="Mfano: Welcome to the new school system..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>Nani Aone Ujumbe Huu:</label>
                        <select id="ann_role">
                            <option value="all">Wote (Login Page)</option>
                            <option value="super_admin">Super Admin Pekee (Baada ya kuingia)</option>
                            <option value="mtaaluma_mkuu">Mtaaluma Mkuu Pekee (Baada ya kuingia)</option>
                            <option value="mtaaluma">Wataaluma Pekee (Baada ya kuingia)</option>
                            <option value="teacher">Walimu Pekee (Baada ya kuingia)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Tarehe ya Kuanza (Start Date):</label>
                        <input type="date" id="ann_start" required>
                    </div>
                    <div class="form-group">
                        <label>Tarehe ya Mwisho (Expiry Date):</label>
                        <input type="date" id="ann_end" required>
                    </div>
                </div>
                <button type="submit" class="btn-primary" style="margin-top:15px; width:100%;">Hifadhi Tangazo</button>
            </form>
        </div>

        <div class="card" style="overflow-x:auto;">
            <h3>Matangazo Yaliyopo (${anns.length})</h3>
            <table>
                <thead><tr><th>Ujumbe (SW)</th><th>Wataoiona</th><th>Muda</th><th>Hali</th><th>Vitendo</th></tr></thead>
                <tbody>
                    ${anns.map(a => `
                        <tr>
                            <td>${a.message_sw.substring(0, 30)}...</td>
                            <td>${a.target_role}</td>
                            <td>${new Date(a.start_date).toLocaleDateString()} - ${new Date(a.end_date).toLocaleDateString()}</td>
                            <td><span class="badge-${a.is_active ? 'paid' : 'unpaid'}">${a.is_active ? 'Inafanya Kazi' : 'Imezimwa'}</span></td>
                            <td>
                                <button class="btn-sm" style="background:${a.is_active ? '#f59e0b' : '#16a34a'};" onclick="toggleAnnouncement(${a.id})">${a.is_active ? 'Zima' : 'Washa'}</button>
                                <button class="btn-sm" style="background:#dc2626;" onclick="deleteAnnouncement(${a.id})">Futa</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function addAnnouncement() {
    const payload = {
        message_sw: document.getElementById('ann_sw').value,
        message_en: document.getElementById('ann_en').value,
        target_role: document.getElementById('ann_role').value,
        start_date: document.getElementById('ann_start').value,
        end_date: document.getElementById('ann_end').value,
        is_active: true
    };
    try {
        const res = await fetch('/api/admin/announcements', { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        alert("Tangazo limehifadhiwa!");
        renderAnnouncements();
    } catch (error) { alert(error.message); }
}

async function toggleAnnouncement(id) {
    await fetch(`/api/admin/announcements/${id}/toggle`, { method: 'PUT', headers: authHeaders });
    renderAnnouncements();
}

async function deleteAnnouncement(id) {
    if(!confirm('Futa tangazo hili?')) return;
    await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE', headers: authHeaders });
    renderAnnouncements();
}

// ==========================================
// 3. WANAFUNZI
// ==========================================
async function renderWanafunzi() {
    content.innerHTML = `<h2>Inapakia Wanafunzi...</h2>`;
    const [r1, r2] = await Promise.all([fetch('/api/students', { headers: authHeaders }), fetch('/api/streams', { headers: authHeaders })]);
    const students = await r1.json(), streams = await r2.json();
    
    content.innerHTML = `
        <div class="card">
            <h3>Sajili Mwanafunzi Mpya</h3>
            <form onsubmit="event.preventDefault(); addStudent();" style="display:flex; gap:10px; flex-wrap:wrap;">
                <input type="text" id="s_name" placeholder="Jina Kamili" required style="flex:1;">
                <select id="s_gender" style="flex:1;"><option value="M">Me</option><option value="F">Ke</option></select>
                <input type="text" id="s_adm" placeholder="Namba ya Usajili" required style="flex:1;">
                <select id="s_stream" required style="flex:1;"><option value="">Chagua Darasa</option>${streams.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select>
                <button type="submit" class="btn-primary">Sajili</button>
            </form>
        </div>
        <div class="card" style="overflow-x:auto;">
            <table>
                <thead><tr><th>Jina</th><th>Darasa</th><th>Jinsia</th><th>Namba</th><th>Futa</th></tr></thead>
                <tbody>${students.map(s => `<tr><td>${s.full_name}</td><td>${streams.find(x => x.id === s.stream_id)?.name || '-'}</td><td>${s.gender}</td><td>${s.admission_number}</td><td><button class="btn-logout" onclick="delStudent(${s.id})" style="padding:5px 10px;font-size:12px;">Futa</button></td></tr>`).join('')}</tbody>
            </table>
        </div>
    `;
}
async function addStudent() {
    const payload = { full_name: document.getElementById('s_name').value, gender: document.getElementById('s_gender').value, admission_number: document.getElementById('s_adm').value, stream_id: document.getElementById('s_stream').value };
    await fetch('/api/students', { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    renderWanafunzi();
}
async function delStudent(id) { if(confirm('Futa mwanafunzi huyu?')) { await fetch('/api/students/' + id, { method: 'DELETE', headers: authHeaders }); renderWanafunzi(); } }

// ==========================================
// 4. WALIMU
// ==========================================
async function renderWalimu() {
    content.innerHTML = `<h2>Inapakia Walimu...</h2>`;
    const res = await fetch('/api/teachers', { headers: authHeaders });
    const teachers = await res.json();
    
    content.innerHTML = `
        <div class="card">
            <h3>Sajili Mwalimu</h3>
            <form onsubmit="event.preventDefault(); addTeacher();" style="display:flex; gap:10px; flex-wrap:wrap;">
                <input type="text" id="t_name" placeholder="Jina Kamili" required style="flex:1;">
                <select id="t_gender" style="flex:1;"><option value="M">Me</option><option value="F">Ke</option></select>
                <input type="text" id="t_phone" placeholder="Simu" required style="flex:1;">
                <select id="t_desig" style="flex:1;"><option value="Mwalimu">Mwalimu</option><option value="Mtaaluma">Mtaaluma</option><option value="Mhasibu">Mhasibu</option><option value="Makamu">Makamu</option></select>
                <button type="submit" class="btn-primary">Sajili</button>
            </form>
        </div>
        <div class="card" style="overflow-x:auto;">
            <table>
                <thead><tr><th>Jina</th><th>Jukumu</th><th>Simu</th><th>Username</th><th>Futa</th></tr></thead>
                <tbody>${teachers.map(t => `<tr><td>${t.full_name}</td><td>${t.designation}</td><td>${t.phone}</td><td>${t.username}</td><td><button class="btn-logout" onclick="delTeacher(${t.id})" style="padding:5px 10px;font-size:12px;">Futa</button></td></tr>`).join('')}</tbody>
            </table>
        </div>
    `;
}
async function addTeacher() {
    const payload = { full_name: document.getElementById('t_name').value, gender: document.getElementById('t_gender').value, phone: document.getElementById('t_phone').value, designation: document.getElementById('t_desig').value };
    await fetch('/api/teachers', { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    renderWalimu();
}
async function delTeacher(id) { if(confirm('Futa mwalimu huyu?')) { await fetch('/api/teachers/' + id, { method: 'DELETE', headers: authHeaders }); renderWalimu(); } }

// ==========================================
// 5. ADA
// ==========================================
async function renderAda() {
    content.innerHTML = `<h2>Inapakia Ada...</h2>`;
    const [r1, r2] = await Promise.all([fetch('/api/fees/balances', { headers: authHeaders }), fetch('/api/students', { headers: authHeaders })]);
    const fees = await r1.json(), students = await r2.json();
    
    content.innerHTML = `
        <div class="card">
            <h3>Weka Malipo ya Ada</h3>
            <form onsubmit="event.preventDefault(); addFee();" style="display:flex; gap:10px; flex-wrap:wrap;">
                <select id="f_stud" required style="flex:1;"><option value="">Chagua Mwanafunzi</option>${students.map(s => `<option value="${s.id}">${s.full_name}</option>`).join('')}</select>
                <input type="number" id="f_amt" placeholder="Kiasi (Tsh)" required style="flex:1;">
                <input type="date" id="f_date" required style="flex:1;">
                <button type="submit" class="btn-primary">Weka</button>
            </form>
        </div>
        <div class="card" style="overflow-x:auto;">
            <table>
                <thead><tr><th>Jina</th><th>Darasa</th><th>Makadirio</th><th>Iliyolipwa</th><th>Deni</th></tr></thead>
                <tbody>${fees.map(f => `<tr><td>${f.full_name}</td><td>${f.stream_name}</td><td>Tsh ${parseInt(f.expected_fee).toLocaleString()}</td><td style="color:green;">Tsh ${parseInt(f.total_paid).toLocaleString()}</td><td style="color:red; font-weight:bold;">Tsh ${parseInt(f.balance).toLocaleString()}</td></tr>`).join('')}</tbody>
            </table>
        </div>
    `;
}
async function addFee() {
    const payload = { student_id: document.getElementById('f_stud').value, amount: document.getElementById('f_amt').value, date_paid: document.getElementById('f_date').value };
    await fetch('/api/fees', { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    renderAda();
}

// ==========================================
// 6. ALAMA
// ==========================================
async function renderAlama() {
    content.innerHTML = `<h2>Inapakia Mfumo wa Alama...</h2>`;
    const user = JSON.parse(localStorage.getItem('user'));
    const canUploadExcel = (user.role === 'mtaaluma' || user.role === 'mtaaluma_mkuu' || user.role === 'super_admin');

    const [e, s, st] = await Promise.all([fetch('/api/exams', { headers: authHeaders }), fetch('/api/subjects', { headers: authHeaders }), fetch('/api/streams', { headers: authHeaders })]);
    const exams = await e.json(), subjects = await s.json(), streams = await st.json();
    
    content.innerHTML = `
        <div class="tabs">
            <button class="tab-btn active" onclick="switchAlamaTab('normal', event)">Normal Entry</button>
            ${canUploadExcel ? `<button class="tab-btn" onclick="switchAlamaTab('excel', event)">Pakia Excel</button>` : ''}
        </div>

        <div id="tab-normal" class="tab-content active">
            <div class="card">
                <h3>Kuingiza Alama (Kwa Mkono)</h3>
                <div style="display:flex; gap:10px; margin-bottom:15px; flex-wrap:wrap;">
                    <select id="a_exam" style="flex:1;">${exams.map(x => `<option value="${x.id}">${x.name}</option>`).join('')}</select>
                    <select id="a_stream" style="flex:1;">${streams.map(x => `<option value="${x.id}">${x.name}</option>`).join('')}</select>
                    <select id="a_subj" style="flex:1;">${subjects.map(x => `<option value="${x.id}">${x.name}</option>`).join('')}</select>
                    <button class="btn-primary" onclick="loadMarks()">Pakia Wanafunzi</button>
                </div>
                <div style="text-align: right; margin-bottom: 10px;">
                    <button class="btn-save-light" style="display:none;" id="save_marks_top" onclick="saveMarks()">💾 Hifadhi Alama</button>
                </div>
                <div style="overflow-x:auto;"><table><thead><tr><th>Jina</th><th>Alama</th></tr></thead><tbody id="marks_table"></tbody></table></div>
                <div style="text-align: right; margin-top: 15px;">
                    <button class="btn-save-light" style="display:none;" id="save_marks_bottom" onclick="saveMarks()">💾 Hifadhi Alama</button>
                </div>
            </div>
        </div>

        <div id="tab-excel" class="tab-content">
            <div class="card">
                <h3>Kupakia Alama kwa Excel</h3>
                <p style="font-size:14px; color:#6b7280; margin-bottom:15px;">Pakua template, jaza alama, kisha pakia hapa. Excel iwe na majina, jinsia, mkondo, na masomo.</p>
                <div style="margin-bottom: 15px;">
                    <a href="#" id="dl-template-btn" class="btn-primary" style="text-decoration:none; display:inline-block;">📥 Pakua Template ya Excel</a>
                </div>
                <form onsubmit="event.preventDefault(); uploadExcel();" style="background:#f9fafb; padding:15px; border-radius:8px; border:1px solid #e5e7eb;">
                    <div class="form-group" style="margin-bottom:15px;">
                        <label>Chagua Mtihani:</label>
                        <select id="ex_exam" required>${exams.map(x => `<option value="${x.id}">${x.name}</option>`).join('')}</select>
                    </div>
                    <div class="form-group" style="margin-bottom:15px;">
                        <label>Chagua Kidato (Mkondo):</label>
                        <select id="ex_stream" required>${streams.map(x => `<option value="${x.id}">${x.name}</option>`).join('')}</select>
                    </div>
                    <div class="form-group" style="margin-bottom:15px;">
                        <label>Chagua Faili la Excel:</label>
                        <input type="file" id="excel_file" accept=".xlsx, .xls" required style="padding:10px; border:1px dashed #ccc; width:100%;">
                    </div>
                    <button type="submit" class="btn-primary" id="upload_btn" style="width:100%;">📤 Pakia Matokeo kwenye Mfumo</button>
                </form>
            </div>
        </div>
    `;
    document.getElementById('dl-template-btn').href = `/api/results/excel-template?token=${token}`;
}

function switchAlamaTab(tabId, event) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
}

async function loadMarks() {
    const ex = document.getElementById('a_exam').value, sub = document.getElementById('a_subj').value, st = document.getElementById('a_stream').value;
    const [r1, r2] = await Promise.all([fetch(`/api/students?stream_id=${st}`, { headers: authHeaders }), fetch(`/api/results/existing?exam_id=${ex}&subject_id=${sub}&stream_id=${st}`, { headers: authHeaders })]);
    const studs = await r1.json(), res = await r2.json();
    const map = {}; res.forEach(r => map[r.student_id] = r.score);
    
    document.getElementById('marks_table').innerHTML = studs.map(x => `<tr><td>${x.full_name}</td><td><input type="number" class="mark-input" data-id="${x.id}" value="${map[x.id] || ''}" style="width:80px;"></td></tr>`).join('');
    document.getElementById('save_marks_top').style.display = 'block';
    document.getElementById('save_marks_bottom').style.display = 'block';
}

async function saveMarks() {
    const ex = document.getElementById('a_exam').value, sub = document.getElementById('a_subj').value;
    const marks = [...document.querySelectorAll('.mark-input')].map(i => ({ student_id: i.dataset.id, score: i.value }));
    await fetch('/api/results', { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ exam_id: ex, subject_id: sub, marks }) });
    alert('Alama zimehifadhiwa!');
}

async function uploadExcel() {
    const examId = document.getElementById('ex_exam').value;
    const fileInput = document.getElementById('excel_file');
    if (!examId || fileInput.files.length === 0) return alert('Chagua mtihani na faili la Excel.');

    const formData = new FormData();
    formData.append('exam_id', examId);
    formData.append('file', fileInput.files[0]);

    const btn = document.getElementById('upload_btn');
    btn.disabled = true; btn.textContent = 'Inapakia... Tafadhali subiri';

    try {
        const res = await fetch('/api/results/upload-excel', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }, 
            body: formData
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Imeshindikana");

        if (result.errors && result.errors.length > 0) {
            alert(`Imekamilika kwa kiasi!\n${result.message}\n\nMakosa:\n${result.errors.join('\n')}`);
        } else {
            alert(`Hongera! ${result.message}`);
            document.getElementById('excel_file').value = '';
        }
    } catch (error) {
        alert(error.message);
    } finally {
        btn.disabled = false; btn.textContent = '📤 Pakia Matokeo kwenye Mfumo';
    }
}

// ==========================================
// 7. BROADSHEET
// ==========================================
async function renderBroadsheet() {
    content.innerHTML = `<h2>Inapakia Broadsheet...</h2>`;
    const [e, st] = await Promise.all([fetch('/api/exams', { headers: authHeaders }), fetch('/api/streams', { headers: authHeaders })]);
    const exams = await e.json(), streams = await st.json();
    
    content.innerHTML = `
        <div class="card">
            <h3>Chagua Mtihani na Darasa</h3>
            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <select id="b_exam">${exams.map(x => `<option value="${x.id}">${x.name}</option>`).join('')}</select>
                <select id="b_stream">${streams.map(x => `<option value="${x.id}">${x.name}</option>`).join('')}</select>
                <button class="btn-primary" onclick="loadBroadsheet()">Pakia</button>
            </div>
            <div style="overflow-x:auto;" id="broadsheet_result"></div>
        </div>
    `;
}
async function loadBroadsheet() {
    const ex = document.getElementById('b_exam').value, st = document.getElementById('b_stream').value;
    const res = await fetch(`/api/reports/broadsheet?exam_id=${ex}&stream_id=${st}`, { headers: authHeaders });
    const d = await res.json();
    
    document.getElementById('broadsheet_result').innerHTML = `
        <table>
            <thead><tr><th>NAFASI</th><th>JINA</th>${d.subjects.map(s => `<th>${s.name.substring(0,3)}</th>`).join('')}<th>WASTANI</th><th>DIV</th></tr></thead>
            <tbody>${d.reportData.map(r => `<tr><td>${r.position}</td><td>${r.full_name}</td>${d.subjects.map(s => `<td>${r.scores[s.id]?.score || '-'}</td>`).join('')}<td>${r.average}</td><td>${r.division}</td></tr>`).join('')}</tbody>
        </table>
    `;
}

// ==========================================
// 8. MAHUDHURIO
// ==========================================
async function renderMahudhurio() {
    content.innerHTML = `<h2>Inapakia Mahudhurio...</h2>`;
    const res = await fetch('/api/streams', { headers: authHeaders });
    const streams = await res.json();
    
    content.innerHTML = `
        <div class="card">
            <h3>Chagua Darasa na Tarehe</h3>
            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <input type="date" id="att_date" required>
                <select id="att_stream">${streams.map(x => `<option value="${x.id}">${x.name}</option>`).join('')}</select>
                <button class="btn-primary" onclick="loadAttendance()">Pakia Wanafunzi</button>
            </div>
            <div style="overflow-x:auto;"><table><thead><tr><th>Jina</th><th>Yupo</th><th>Hayupo</th></tr></thead><tbody id="att_table"></tbody></table></div>
            <button class="btn-green" style="margin-top:10px; display:none;" id="save_att_btn" onclick="saveAttendance()">Hifadhi Mahudhurio</button>
        </div>
    `;
}
async function loadAttendance() {
    const st = document.getElementById('att_stream').value;
    const res = await fetch(`/api/students?stream_id=${st}`, { headers: authHeaders });
    const students = await res.json();
    
    document.getElementById('att_table').innerHTML = students.map(s => `<tr><td>${s.full_name}</td><td><input type="radio" name="att_${s.id}" value="Present" checked></td><td><input type="radio" name="att_${s.id}" value="Absent"></td></tr>`).join('');
    document.getElementById('save_att_btn').style.display = 'block';
}
async function saveAttendance() {
    const date = document.getElementById('att_date').value;
    if(!date) return alert('Weka tarehe kwanza');
    const records = [];
    document.querySelectorAll('input[type="radio"]:checked').forEach(r => { records.push({ student_id: r.name.split('_')[1], status: r.value }); });
    await fetch('/api/attendance', { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ records, date }) });
    alert('Mahudhurio yamehifadhiwa!');
}

// ==========================================
// 9. KUPANGA WALIMU
// ==========================================
async function renderKupanga() {
    content.innerHTML = `<h2>Inapakia Kupanga Walimu...</h2>`;
    const [t, st, su, a] = await Promise.all([fetch('/api/teachers', { headers: authHeaders }), fetch('/api/streams', { headers: authHeaders }), fetch('/api/subjects', { headers: authHeaders }), fetch('/api/assignments', { headers: authHeaders })]);
    const teachers = await t.json(), streams = await st.json(), subjects = await su.json(), assignments = await a.json();
    
    content.innerHTML = `
        <div class="card">
            <h3>Gawa Somo kwa Mwalimu</h3>
            <form onsubmit="event.preventDefault(); addAssignment();" style="display:flex; gap:10px; flex-wrap:wrap;">
                <select id="as_teacher" required style="flex:1;"><option value="">Chagua Mwalimu</option>${teachers.map(x => `<option value="${x.id}">${x.full_name}</option>`).join('')}</select>
                <select id="as_stream" required style="flex:1;"><option value="">Chagua Darasa</option>${streams.map(x => `<option value="${x.id}">${x.name}</option>`).join('')}</select>
                <select id="as_subject" required style="flex:1;"><option value="">Chagua Somo</option>${subjects.map(x => `<option value="${x.id}">${x.name}</option>`).join('')}</select>
                <button type="submit" class="btn-primary">Gawa</button>
            </form>
        </div>
        <div class="card" style="overflow-x:auto;">
            <table>
                <thead><tr><th>Mwalimu</th><th>Darasa</th><th>Somo</th></tr></thead>
                <tbody>${assignments.map(x => `<tr><td>${x.teacher_name}</td><td>${x.stream_name}</td><td>${x.subject_name}</td></tr>`).join('')}</tbody>
            </table>
        </div>
    `;
}
async function addAssignment() {
    const payload = { teacher_id: document.getElementById('as_teacher').value, stream_id: document.getElementById('as_stream').value, subject_id: document.getElementById('as_subject').value };
    await fetch('/api/assignments', { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    renderKupanga();
}

// ==========================================
// 10. RIPOTI (BORA & WABOVU)
// ==========================================
async function renderRipoti() {
    content.innerHTML = `<h2>Inapakia Ripoti...</h2>`;
    const [e, st] = await Promise.all([fetch('/api/exams', { headers: authHeaders }), fetch('/api/streams', { headers: authHeaders })]);
    const exams = await e.json(), streams = await st.json();
    
    content.innerHTML = `
        <div class="card">
            <h3>Chagua Mtihani na Aina ya Ripoti</h3>
            <div style="display:flex; gap:10px; margin-bottom:15px; flex-wrap:wrap;">
                <select id="r_exam" style="flex:1;">${exams.map(x => `<option value="${x.id}">${x.name}</option>`).join('')}</select>
                <select id="r_stream" style="flex:1;"><option value="">Madarasa Yote</option>${streams.map(x => `<option value="${x.id}">${x.name}</option>`).join('')}</select>
                <select id="r_type" style="flex:1;"><option value="top">Wanafunzi Bora (Top 50)</option><option value="worst">Wanafunzi Wabovu (Bottom 50)</option></select>
                <button class="btn-primary" onclick="loadRipoti()">Pakia</button>
            </div>
            <div style="overflow-x:auto;" id="ripoti_result"></div>
        </div>
    `;
}
async function loadRipoti() {
    const ex = document.getElementById('r_exam').value, st = document.getElementById('r_stream').value, tp = document.getElementById('r_type').value;
    const res = await fetch(`/api/reports/top-students?exam_id=${ex}&stream_id=${st}&type=${tp}`, { headers: authHeaders });
    const d = await res.json();
    
    document.getElementById('ripoti_result').innerHTML = `
        <table>
            <thead><tr><th>NAFASI</th><th>JINA</th><th>DARASA</th><th>WASTANI</th><th>DIV</th></tr></thead>
            <tbody>${d.reportData.map(r => `<tr><td>${r.rank}</td><td>${r.full_name}</td><td>${r.stream_name}</td><td>${r.average}</td><td>${r.division}</td></tr>`).join('')}</tbody>
        </table>
    `;
}

// ==========================================
// 11. MIPANGILIO
// ==========================================
async function renderMipangilio() {
    content.innerHTML = `<h2>Inapakia Mipangilio...</h2>`;
    const [s, su, e] = await Promise.all([fetch('/api/streams', { headers: authHeaders }), fetch('/api/subjects', { headers: authHeaders }), fetch('/api/exams', { headers: authHeaders })]);
    const streams = await s.json(), subjects = await su.json(), exams = await e.json();
    
    content.innerHTML = `
        <div class="grid-3">
            <div class="card">
                <h3>Madarasa (Streams)</h3>
                <form onsubmit="event.preventDefault(); addStream();" style="margin-bottom:10px;">
                    <input type="text" id="set_sname" placeholder="Jina la Darasa" required>
                    <input type="number" id="set_sfee" placeholder="Ada (Tsh)" required>
                    <button type="submit" class="btn-primary">Ongeza</button>
                </form>
                <ul>${streams.map(x => `<li>${x.name} (Tsh ${parseInt(x.fee_amount).toLocaleString()})</li>`).join('')}</ul>
            </div>
            <div class="card">
                <h3>Masomo (Subjects)</h3>
                <form onsubmit="event.preventDefault(); addSubject();" style="margin-bottom:10px;">
                    <input type="text" id="set_subname" placeholder="Jina la Somo" required>
                    <button type="submit" class="btn-primary">Ongeza</button>
                </form>
                <ul>${subjects.map(x => `<li>${x.name}</li>`).join('')}</ul>
            </div>
            <div class="card">
                <h3>Mitihani (Exams)</h3>
                <form onsubmit="event.preventDefault(); addExam();" style="margin-bottom:10px;">
                    <input type="text" id="set_exname" placeholder="Jina la Mtihani" required>
                    <button type="submit" class="btn-primary">Ongeza</button>
                </form>
                <ul>${exams.map(x => `<li>${x.name}</li>`).join('')}</ul>
            </div>
        </div>
    `;
}
async function addStream() {
    await fetch('/api/streams', { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: document.getElementById('set_sname').value, fee_amount: document.getElementById('set_sfee').value }) });
    renderMipangilio();
}
async function addSubject() {
    await fetch('/api/subjects', { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: document.getElementById('set_subname').value }) });
    renderMipangilio();
}
async function addExam() {
    await fetch('/api/exams', { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: document.getElementById('set_exname').value }) });
    renderMipangilio();
}

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('token')) {
        showApp();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-screen').style.display = 'none';
        loadLoginAnnouncements(); // Vuta matangazo ya login
    }
});