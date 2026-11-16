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
    } else {
        document.getElementById('nav-kusajili_shule').style.display = 'none';
        document.getElementById('nav-announcements').style.display = 'none';
        document.getElementById('nav-subscription_mgmt').style.display = 'none';
        document.getElementById('nav-my_subscription').style.display = 'block';
    }
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
    else if (page === 'mipangilio') renderMipangilio();
}

// ==========================================
// MY SUBSCRIPTION (UPDATED FOR GATEWAY)
// ==========================================
async function renderMySubscription() {
    content.innerHTML = `<h2>Inapakia Taarifa za Usajili...</h2>`;
    try {
        const res = await fetch('/api/subscriptions/my-subscription', { headers: authHeaders });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);

        const s = d.school;
        const settings = d.settings;
        const payments = d.payments;

        let remainingDays = 0;
        if (s.subscription_status === 'TRIAL_ACTIVE' && s.trial_end_date) {
            remainingDays = Math.ceil((new Date(s.trial_end_date) - new Date()) / (1000 * 60 * 60 * 24));
        } else if (s.subscription_status === 'SUBSCRIPTION_ACTIVE' && s.subscription_end_date) {
            remainingDays = Math.ceil((new Date(s.subscription_end_date) - new Date()) / (1000 * 60 * 60 * 24));
        }

        content.innerHTML = `
            <div class="card">
                <h3>Hali ya Usajili wa Shule Yako</h3>
                <div style="display:flex; gap:20px; flex-wrap:wrap; margin-top:15px;">
                    <div style="flex:1; background:#f8fafc; padding:15px; border-radius:8px;">
                        <p><strong>Hali:</strong> <span class="badge-active">${s.subscription_status}</span></p>
                        <p><strong>Siku Zilizobaki:</strong> ${remainingDays} siku</p>
                    </div>
                    <div style="flex:1; background:#f8fafc; padding:15px; border-radius:8px;">
                        <p><strong>Ada ya Mwaka:</strong> Tsh ${parseInt(settings.annual_fee).toLocaleString()}</p>
                        <p><strong>Maelekezo:</strong> ${settings.instructions_sw}</p>
                    </div>
                </div>
            </div>

            <div class="card">
                <h3>Lipa Ada ya Mfumo (Automatic)</h3>
                <p style="font-size:14px; color:#6b7280; margin-bottom:15px;">Weka namba yako ya simu ili upokee ujumbe wa malipo (USSD Push).</p>
                <form onsubmit="event.preventDefault(); initiatePayment();">
                    <div class="form-group">
                        <label>Namba ya Simu (M-Pesa/Airtel/Tigo):</label>
                        <input type="text" id="pay_phone" required placeholder="Mfano: 255712345678">
                    </div>
                    <button type="submit" class="btn-primary" style="width:100%;">Lipa Tsh ${parseInt(settings.annual_fee).toLocaleString()}</button>
                </form>
            </div>

            <div class="card" style="overflow-x:auto;">
                <h3>Historia ya Malipo</h3>
                <table>
                    <thead><tr><th>Tarehe</th><th>Kiasi</th><th>Njia</th><th>Ref</th><th>Hali</th></tr></thead>
                    <tbody>${payments.map(p => `<tr><td>${new Date(p.created_at).toLocaleDateString()}</td><td>Tsh ${parseInt(p.amount).toLocaleString()}</td><td>${p.payment_method || 'Mobile'}</td><td>${p.internal_reference}</td><td><span class="badge-${p.status === 'SUCCESS' ? 'active' : 'inactive'}">${p.status}</span></td></tr>`).join('')}</tbody>
                </table>
            </div>
        `;
    } catch (error) { content.innerHTML = `<h2 style="color:red;">Kosa: ${error.message}</h2>`; }
}

async function initiatePayment() {
    const phone = document.getElementById('pay_phone').value;
    if (!phone) return alert('Weka namba ya simu.');

    try {
        const res = await fetch('/api/subscriptions/payments', {
            method: 'POST',
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone_number: phone })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        alert('Malipo yameanzishwa! Tafadhali thibitisha kwenye simu yako.');
        renderMySubscription();
    } catch (error) { alert(error.message); }
}

// ==========================================
// SUPER ADMIN SUBSCRIPTION MGMT (GATEWAY SETTINGS)
// ==========================================
async function renderSubscriptionMgmt() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'super_admin') return;

    content.innerHTML = `<h2>Inapakia Mipangilio...</h2>`;
    try {
        const [setRes] = await Promise.all([
            fetch('/api/subscriptions/settings', { headers: authHeaders })
        ]);
        const settings = await setRes.json();

        content.innerHTML = `
            <div class="card">
                <h3>Mipangilio ya Payment Gateway</h3>
                <form onsubmit="event.preventDefault(); saveSubSettings();">
                    <div class="form-grid">
                        <div class="form-group"><label>Ada ya Mwaka:</label><input type="number" id="s_fee" value="${settings.annual_fee}" required></div>
                        <div class="form-group"><label>Muda (Miezi):</label><input type="number" id="s_dur" value="${settings.duration_months}" required></div>
                        <div class="form-group"><label>Siku za Trial:</label><input type="number" id="s_trial" value="${settings.trial_days}" required></div>
                        <div class="form-group"><label>Payment Gateway:</label><input type="text" id="s_provider" value="${settings.gateway_provider || 'SNIPPE'}" required></div>
                        <div class="form-group"><label>WhatsApp:</label><input type="text" id="s_wa" value="${settings.support_whatsapp}" required></div>
                    </div>
                    <div class="form-group"><label>Maelekezo:</label><textarea id="s_inst" required>${settings.instructions_sw}</textarea></div>
                    <div class="form-group"><label>Gateway API Key:</label><input type="password" id="s_apikey" placeholder="Weka API Key hapa"></div>
                    <div class="form-group"><label>Webhook Secret:</label><input type="password" id="s_secret" placeholder="Weka Webhook Secret hapa"></div>
                    <button type="submit" class="btn-primary" style="width:100%;">Hifadhi Mipangilio</button>
                </form>
            </div>
            <div class="card" style="overflow-x:auto;">
                <h3>Usimamizi wa Shule (Zote)</h3>
                <p style="font-size:14px; color:#6b7280;">Kumbuka: Malipo yanathibitishwa kiotomatiki na gateway. Huna haja ya kuidhinisha wewe mwenyewe.</p>
                <table>
                    <thead><tr><th>Shule</th><th>Halmashauri</th><th>Hali</th><th>Trial End</th><th>Sub End</th></tr></thead>
                    <tbody id="school-list-table"></tbody>
                </table>
            </div>
        `;

        const schRes = await fetch('/api/schools', { headers: authHeaders });
        const schools = await schRes.json();
        document.getElementById('school-list-table').innerHTML = schools.map(s => `
            <tr>
                <td><strong>${s.name}</strong></td>
                <td>${s.district || '-'}</td>
                <td><span class="badge-${s.subscription_status === 'SUBSCRIPTION_ACTIVE' ? 'active' : 'inactive'}">${s.subscription_status}</span></td>
                <td>${s.trial_end_date ? new Date(s.trial_end_date).toLocaleDateString() : '-'}</td>
                <td>${s.subscription_end_date ? new Date(s.subscription_end_date).toLocaleDateString() : '-'}</td>
            </tr>
        `).join('');

    } catch (error) { content.innerHTML = `<h2 style="color:red;">Kosa: ${error.message}</h2>`; }
}

async function saveSubSettings() {
    const payload = {
        annual_fee: document.getElementById('s_fee').value,
        duration_months: document.getElementById('s_dur').value,
        trial_days: document.getElementById('s_trial').value,
        support_whatsapp: document.getElementById('s_wa').value,
        instructions_sw: document.getElementById('s_inst').value,
        gateway_provider: document.getElementById('s_provider').value,
        gateway_api_key: document.getElementById('s_apikey').value,
        gateway_webhook_secret: document.getElementById('s_secret').value
    };
    await fetch('/api/admin/subscriptions/settings', { method: 'PUT', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    alert('Mipangilio imehifadhiwa!');
}

// (Weka function zingine zote za renderDashboard, renderWanafunzi, n.k. chini hapa kama zilivyokuwa)
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('token')) { showApp(); } 
    else { document.getElementById('login-screen').style.display = 'flex'; document.getElementById('app-screen').style.display = 'none'; loadLoginAnnouncements(); }
});