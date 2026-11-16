// (Weka code kamili ya app.js hapa kama ilivyoelezwa kwenye majibu yaliyopita)
// Nakupa code ya msingi ya Subscription na Login ili uunganishe na APIs mpya.

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
    // ... (Weka kurasa zingine hapa kama walimu, wanafunzi, n.k.)
}

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
                <h3>Wasilisha Malipo Mapya</h3>
                <form onsubmit="event.preventDefault(); submitPayment();">
                    <div class="form-group">
                        <label>Kiasi Kilicholipwa (Tsh):</label>
                        <input type="number" id="p_amt" required value="${settings.annual_fee}">
                    </div>
                    <div class="form-group">
                        <label>Njia ya Malipo:</label>
                        <select id="p_method" required>
                            <option value="M-PESA">M-PESA (${settings.mpesa_number})</option>
                            <option value="TIGO PESA">TIGO PESA (${settings.tigopesa_number})</option>
                            <option value="AIRTEL MONEY">AIRTEL MONEY (${settings.airtel_number})</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Namba ya Malipo (Transaction Reference):</label>
                        <input type="text" id="p_ref" required placeholder="Mfano: MP123456789">
                    </div>
                    <div class="form-group">
                        <label>Tarehe ya Malipo:</label>
                        <input type="date" id="p_date" required>
                    </div>
                    <div class="form-group">
                        <label>Pakia Picha ya Risiti (Hiari):</label>
                        <input type="file" id="p_proof" accept="image/*">
                    </div>
                    <button type="submit" class="btn-primary" style="width:100%;">Wasilisha Malipo</button>
                </form>
            </div>

            <div class="card">
                <h3>Historia ya Malipo</h3>
                <table>
                    <thead><tr><th>Tarehe</th><th>Kiasi</th><th>Njia</th><th>Ref</th><th>Hali</th></tr></thead>
                    <tbody>${payments.map(p => `<tr><td>${new Date(p.payment_date).toLocaleDateString()}</td><td>Tsh ${parseInt(p.amount).toLocaleString()}</td><td>${p.payment_method}</td><td>${p.transaction_reference}</td><td><span class="badge-${p.status === 'APPROVED' ? 'active' : 'inactive'}">${p.status}</span></td></tr>`).join('')}</tbody>
                </table>
            </div>
        `;
    } catch (error) { content.innerHTML = `<h2 style="color:red;">Kosa: ${error.message}</h2>`; }
}

async function submitPayment() {
    const amt = document.getElementById('p_amt').value;
    const method = document.getElementById('p_method').value;
    const ref = document.getElementById('p_ref').value;
    const date = document.getElementById('p_date').value;
    const file = document.getElementById('p_proof').files[0];

    let proofBase64 = null;
    if (file) {
        proofBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    }

    try {
        const res = await fetch('/api/subscriptions/payments', {
            method: 'POST',
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amt, payment_method: method, transaction_reference: ref, payment_date: date, proof: proofBase64 })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        alert('Malipo yamewasilishwa! Yanasubiri uhakiki wa Super Admin.');
        renderMySubscription();
    } catch (error) { alert(error.message); }
}

async function renderSubscriptionMgmt() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'super_admin') return;

    content.innerHTML = `<h2>Inapakia Mipangilio...</h2>`;
    try {
        const [setRes, payRes] = await Promise.all([
            fetch('/api/subscriptions/settings', { headers: authHeaders }),
            fetch('/api/admin/subscriptions/payments', { headers: authHeaders })
        ]);
        const settings = await setRes.json();
        const payments = await payRes.json();

        content.innerHTML = `
            <div class="card">
                <h3>Mipangilio ya Malipo</h3>
                <form onsubmit="event.preventDefault(); saveSubSettings();">
                    <div class="form-grid">
                        <div class="form-group"><label>Ada ya Mwaka:</label><input type="number" id="s_fee" value="${settings.annual_fee}" required></div>
                        <div class="form-group"><label>Muda (Miezi):</label><input type="number" id="s_dur" value="${settings.duration_months}" required></div>
                        <div class="form-group"><label>Siku za Trial:</label><input type="number" id="s_trial" value="${settings.trial_days}" required></div>
                        <div class="form-group"><label>M-PESA:</label><input type="text" id="s_mpesa" value="${settings.mpesa_number}" required></div>
                        <div class="form-group"><label>TIGO PESA:</label><input type="text" id="s_tigo" value="${settings.tigopesa_number}" required></div>
                        <div class="form-group"><label>AIRTEL:</label><input type="text" id="s_airtel" value="${settings.airtel_number}" required></div>
                        <div class="form-group"><label>Jina la Mpokeaji:</label><input type="text" id="s_payee" value="${settings.payee_name}" required></div>
                        <div class="form-group"><label>WhatsApp:</label><input type="text" id="s_wa" value="${settings.support_whatsapp}" required></div>
                    </div>
                    <div class="form-group"><label>Maelekezo:</label><textarea id="s_inst" required>${settings.instructions_sw}</textarea></div>
                    <button type="submit" class="btn-primary" style="width:100%;">Hifadhi Mipangilio</button>
                </form>
            </div>

            <div class="card" style="overflow-x:auto;">
                <h3>Uhakiki wa Malipo (${payments.length})</h3>
                <table>
                    <thead><tr><th>Shule</th><th>Kiasi</th><th>Njia</th><th>Ref</th><th>Tarehe</th><th>Hali</th><th>Vitendo</th></tr></thead>
                    <tbody>
                        ${payments.map(p => `
                            <tr>
                                <td><strong>${p.school_name}</strong></td>
                                <td>Tsh ${parseInt(p.amount).toLocaleString()}</td>
                                <td>${p.payment_method}</td>
                                <td>${p.transaction_reference}</td>
                                <td>${new Date(p.payment_date).toLocaleDateString()}</td>
                                <td><span class="badge-${p.status === 'APPROVED' ? 'active' : 'inactive'}">${p.status}</span></td>
                                <td>
                                    ${p.status === 'PENDING' ? `
                                        <button class="btn-green" onclick="approvePayment(${p.id})" style="padding:5px 10px;font-size:12px;">Approve</button>
                                        <button class="btn-red" onclick="rejectPayment(${p.id})" style="padding:5px 10px;font-size:12px;margin-left:5px;">Reject</button>
                                    ` : '-'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) { content.innerHTML = `<h2 style="color:red;">Kosa: ${error.message}</h2>`; }
}

async function approvePayment(id) {
    if(!confirm('Thibitisha umepokea malipo haya?')) return;
    try {
        const res = await fetch(`/api/admin/payments/${id}/approve`, { method: 'POST', headers: authHeaders });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        alert('Malipo yameidhinishwa!');
        renderSubscriptionMgmt();
    } catch (e) { alert(e.message); }
}

async function rejectPayment(id) {
    const reason = prompt("Weka sababu ya kukataa malipo haya:");
    if (!reason) return;
    try {
        const res = await fetch(`/api/admin/payments/${id}/reject`, {
            method: 'POST',
            headers: { ...authHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        alert('Malipo yamekataliwa!');
        renderSubscriptionMgmt();
    } catch (e) { alert(e.message); }
}

async function saveSubSettings() {
    const payload = {
        annual_fee: document.getElementById('s_fee').value,
        duration_months: document.getElementById('s_dur').value,
        trial_days: document.getElementById('s_trial').value,
        mpesa_number: document.getElementById('s_mpesa').value,
        tigopesa_number: document.getElementById('s_tigo').value,
        airtel_number: document.getElementById('s_airtel').value,
        payee_name: document.getElementById('s_payee').value,
        support_whatsapp: document.getElementById('s_wa').value,
        instructions_sw: document.getElementById('s_inst').value,
        welcome_message_sw: "Karibu",
        mpesa_active: true, tigopesa_active: true, airtel_active: true
    };
    await fetch('/api/admin/subscriptions/settings', { method: 'PUT', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    alert('Mipangilio imehifadhiwa!');
}

// (Weka function zingine zote za renderDashboard, renderWanafunzi, n.k. chini hapa)
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('token')) { showApp(); } 
    else { document.getElementById('login-screen').style.display = 'flex'; document.getElementById('app-screen').style.display = 'none'; loadLoginAnnouncements(); }
});