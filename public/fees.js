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
});

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

async function loadBalances() {
    const tableBody = document.getElementById('balances-table-body');
    try {
        const response = await fetch('/api/fees/balances', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error("Imeshindwa kuleta salio");
        const data = await response.json();

        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">Hakuna wanafunzi kwenye mfumo.</td></tr>`;
            return;
        }

        let html = '';
        data.forEach((row, index) => {
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
                    <td>
                        <button class="btn-details" onclick="openInstallmentModal(${row.id})">Angalia Awamu</button>
                    </td>
                </tr>
            `;
        });
        tableBody.innerHTML = html;

    } catch (error) { tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Kosa la mtandao.</td></tr>`; }
}

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
            loadBalances(); 
            
            showReceipt(data.id);
            
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

// ==========================================
// KAZI YA KUONYESHA AWAMU (INSTALLMENTS)
// ==========================================
async function openInstallmentModal(studentId) {
    const modal = document.getElementById('installmentModal');
    const tableBody = document.getElementById('installment-table-body');
    
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Inapakia data...</td></tr>`;
    
    // Weka tarehe ya leo kwenye taarifa
    const today = new Date().toLocaleDateString('sw-TZ');
    document.getElementById('modal-date').innerText = today;

    modal.style.display = 'block';

    try {
        const response = await fetch(`/api/fees/student-summary/${studentId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Imeshindwa kuleta data");
        const data = await response.json();

        // Weka Maelezo ya Juu
        document.getElementById('modal-student-name').innerText = data.student.full_name;
        document.getElementById('modal-student-stream').innerText = data.student.stream_name || 'Hajapewa Darasa';
        
        document.getElementById('modal-expected-fee').innerText = parseFloat(data.student.expected_fee).toLocaleString();
        document.getElementById('modal-total-paid').innerText = data.total_paid.toLocaleString();
        
        const balanceText = data.balance > 0 
            ? `- ${data.balance.toLocaleString()}` 
            : `+ ${Math.abs(data.balance).toLocaleString()} (Ziada)`;
        document.getElementById('modal-balance').innerText = balanceText;

        // Onyesha Ujumbe wa Pongezi au Deni
        const congrats = document.getElementById('congrats-message');
        const debt = document.getElementById('debt-message');
        
        if (data.balance <= 0) {
            congrats.style.display = 'block';
            debt.style.display = 'none';
        } else {
            congrats.style.display = 'none';
            debt.style.display = 'block';
        }

        // Jaza Jedwali la Awamu
        if (data.installments.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Hakuna malipo yaliyofanyika bado.</td></tr>`;
        } else {
            let html = '';
            data.installments.forEach(inst => {
                const dateObj = new Date(inst.date_paid);
                const formattedDate = isNaN(dateObj) ? inst.date_paid : dateObj.toLocaleDateString('sw-TZ');

                html += `
                    <tr>
                        <td style="font-weight: bold; color: #1e3a8a;">Awamu ya ${inst.awamu}</td>
                        <td>${formattedDate}</td>
                        <td>${inst.amount.toLocaleString()}</td>
                        <td>
                            <button class="btn-receipt" onclick="showReceipt(${inst.id})">Risiti</button>
                        </td>
                    </tr>
                `;
            });
            tableBody.innerHTML = html;
        }

    } catch (error) {
        console.error(error);
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: red;">Kosa la mtandao.</td></tr>`;
    }
}

function closeInstallmentModal() {
    document.getElementById('installmentModal').style.display = 'none';
}

// ==========================================
// KAZI YA KUONYESHA RISITI (Ile ya Awali)
// ==========================================
async function showReceipt(feeId) {
    // Ficha modal ya awamu kama ipo wazi
    document.getElementById('installmentModal').style.display = 'none';

    try {
        const response = await fetch(`/api/fees/receipt/${feeId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Imeshindwa kupata risiti");
        const data = await response.json();

        document.getElementById('r-school-name').innerText = data.school_name;
        document.getElementById('r-receipt-no').innerText = data.receipt_no;
        
        const dateObj = new Date(data.date_paid);
        const formattedDate = isNaN(dateObj) ? data.date_paid : dateObj.toLocaleDateString('sw-TZ');
        document.getElementById('r-date').innerText = formattedDate;

        const year = isNaN(dateObj) ? new Date().getFullYear() : dateObj.getFullYear();
        document.getElementById('r-year').innerText = year;

        document.getElementById('r-student-name').innerText = data.student_name;
        document.getElementById('r-adm-no').innerText = data.admission_number || '-';
        document.getElementById('r-stream').innerText = data.stream_name || 'Hajapewa';

        document.getElementById('r-amount-paid').innerText = parseFloat(data.amount_paid).toLocaleString();
        document.getElementById('r-total-paid').innerText = parseFloat(data.total_paid).toLocaleString();
        document.getElementById('r-expected-fee').innerText = parseFloat(data.expected_fee).toLocaleString();
        
        const balanceText = data.balance > 0 
            ? `- ${data.balance.toLocaleString()}` 
            : `+ ${Math.abs(data.balance).toLocaleString()} (Ziada)`;
        document.getElementById('r-balance').innerText = balanceText;

        document.getElementById('receiptModal').style.display = 'block';

    } catch (error) {
        console.error(error);
        alert("Kuna tatizo limetokea wakati wa kuleta risiti.");
    }
}

function closeReceipt() {
    document.getElementById('receiptModal').style.display = 'none';
}