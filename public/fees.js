const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');

if (!token || !userStr) {
    window.location.replace('/login.html');
}

function logout() {
    localStorage.clear();
    window.location.replace('/login.html');
}

document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('payment-date').value = today;
    
    loadStudentsDropdown();
    loadBalances();
    loadFeesHistory();
});

// 1. Pakia Wanafunzi kwenye Dropdown
async function loadStudentsDropdown() {
    const select = document.getElementById('student-select');
    try {
        const response = await fetch('/api/students', { headers: { 'Authorization': `Bearer ${token}` } });
        const students = await response.json();
        
        select.innerHTML = '<option value="">-- Chagua Mwanafunzi --</option>';
        students.forEach(student => {
            const option = document.createElement('option');
            option.value = student.id;
            option.text = `${student.full_name} (${student.admission_number || 'No Adm'})`;
            select.appendChild(option);
        });
    } catch (error) { console.error("Kosa la kuleta wanafunzi:", error); }
}

// 2. Pakia Salio (Balances)
async function loadBalances() {
    const tableBody = document.getElementById('balances-table-body');
    try {
        const response = await fetch('/api/fees/balances', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error("Imeshindwa kuleta salio");
        const data = await response.json();

        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">Hakuna wanafunzi kwenye mfumo.</td></tr>`;
            return;
        }

        let html = '';
        data.forEach((row, index) => {
            // Rangi ya Deni (Kama ana deni kubwa kuliko 0, weka nyekundu)
            const balanceColor = row.balance > 0 ? 'text-danger' : 'text-success';
            const balanceText = row.balance > 0 ? `- ${row.balance.toLocaleString()}` : `+ ${Math.abs(row.balance).toLocaleString()} (Ziada)`;

            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${row.full_name}</td>
                    <td>${row.stream_name || 'Hajapewa'}</td>
                    <td>${parseFloat(row.expected_fee).toLocaleString()}</td>
                    <td>${parseFloat(row.total_paid).toLocaleString()}</td>
                    <td class="${balanceColor}">${balanceText}</td>
                </tr>
            `;
        });
        tableBody.innerHTML = html;

    } catch (error) { tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Kosa la mtandao.</td></tr>`; }
}

// 3. Pakia Historia ya Malipo
async function loadFeesHistory() {
    const tableBody = document.getElementById('fees-table-body');
    try {
        const response = await fetch('/api/fees', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error("Imeshindwa kuleta historia");
        const fees = await response.json();

        if (fees.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Hakuna malipo yaliyorekodiwa bado.</td></tr>`;
            return;
        }

        let html = '';
        fees.forEach((fee, index) => {
            const dateObj = new Date(fee.date_paid);
            const formattedDate = isNaN(dateObj) ? (fee.date_paid || 'Hajajaza') : dateObj.toLocaleDateString('sw-TZ');

            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${fee.student_name || 'Mwanafunzi Hayupo'}</td>
                    <td>${parseFloat(fee.amount).toLocaleString()}</td>
                    <td>${formattedDate}</td>
                </tr>
            `;
        });
        tableBody.innerHTML = html;

    } catch (error) { tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: red;">Kosa la mtandao.</td></tr>`; }
}

// 4. Wasilisha Fomu ya Malipo
document.getElementById('feeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusMsg = document.getElementById('status-msg');
    
    const student_id = document.getElementById('student-select').value;
    const amount = document.getElementById('amount').value;
    const date_paid = document.getElementById('payment-date').value; 

    statusMsg.innerText = "Inahifadhi..."; statusMsg.style.color = "blue";

    try {
        const response = await fetch('/api/fees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ student_id, amount, date_paid })
        });

        const data = await response.json();

        if (response.ok) {
            statusMsg.innerText = "✅ Malipo yamehifadhiwa!";
            statusMsg.style.color = "green";
            document.getElementById('feeForm').reset();
            document.getElementById('payment-date').value = date_paid;
            loadBalances(); // Refresh salio
            loadFeesHistory(); // Refresh historia
            setTimeout(() => { statusMsg.innerText = ""; }, 3000);
        } else {
            statusMsg.innerText = `❌ Kosa: ${data.error || 'Imeshindikana'}`;
            statusMsg.style.color = "red";
        }
    } catch (error) {
        console.error("Kosa la mtandao:", error);
        statusMsg.innerText = "❌ Kosa la mtandao";
        statusMsg.style.color = "red";
    }
});