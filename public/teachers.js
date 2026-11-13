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
    loadTeachers();
});

async function loadTeachers() {
    const tableBody = document.getElementById('teachers-table-body');
    try {
        const response = await fetch('/api/teachers', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error("Imeshindwa");
        const teachers = await response.json();

        if (teachers.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Hakuna walimu.</td></tr>`;
            return;
        }

        let html = '';
        teachers.forEach((teacher, index) => {
            const phone = teacher.phone || teacher.phone_number || 'Hajajaza';
            const email = teacher.email || 'Hajajaza';
            const jinsia = teacher.gender || 'Hajajaza';

            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${teacher.full_name}</td>
                    <td>${jinsia}</td>
                    <td>${phone}</td>
                    <td>${email}</td>
                </tr>
            `;
        });
        tableBody.innerHTML = html;
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Kosa la mtandao.</td></tr>`;
    }
}

document.getElementById('teacherForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusMsg = document.getElementById('status-msg');
    
    const payload = {
        full_name: document.getElementById('full_name').value,
        gender: document.getElementById('gender').value,
        phone: document.getElementById('phone').value,
        email: document.getElementById('email').value
    };

    statusMsg.innerText = "Inasajili..."; statusMsg.style.color = "blue";

    try {
        const response = await fetch('/api/teachers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            statusMsg.innerText = "✅ Mwalimu amesajiliwa!";
            statusMsg.style.color = "green";
            document.getElementById('teacherForm').reset();
            loadTeachers();
            setTimeout(() => { statusMsg.innerText = ""; }, 3000);
        } else {
            statusMsg.innerText = `❌ Kosa: ${data.error}`;
            statusMsg.style.color = "red";
        }
    } catch (error) {
        statusMsg.innerText = "❌ Kosa la mtandao"; statusMsg.style.color = "red";
    }
});