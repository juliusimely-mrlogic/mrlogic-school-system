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
    loadSchools();
});

// 1. Pakia Shule Zilizopo
async function loadSchools() {
    const tableBody = document.getElementById('schools-table-body');
    try {
        const response = await fetch('/api/schools', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error("Imeshindwa");
        const schools = await response.json();

        if (schools.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">Hakuna shule zilizosajiliwa.</td></tr>`;
            return;
        }

        let html = '';
        schools.forEach((school, index) => {
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${school.name}</td>
                    <td>${school.code || '-'}</td>
                    <td>${school.region || '-'}</td>
                    <td>${school.district || '-'}</td>
                    <td>
                        <button class="btn-delete" onclick="deleteSchool(${school.id})">Futa</button>
                    </td>
                </tr>
            `;
        });
        tableBody.innerHTML = html;

    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Kosa la mtandao.</td></tr>`;
    }
}

// 2. Wasilisha Fomu
document.getElementById('schoolForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusMsg = document.getElementById('status-msg');
    
    const payload = {
        name: document.getElementById('name').value,
        code: document.getElementById('code').value,
        region: document.getElementById('region').value,
        district: document.getElementById('district').value
    };

    statusMsg.innerText = "Inasajili..."; statusMsg.style.color = "blue";

    try {
        const response = await fetch('/api/schools', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            statusMsg.innerText = "✅ Shule imesajiliwa!";
            statusMsg.style.color = "green";
            document.getElementById('schoolForm').reset();
            loadSchools();
            setTimeout(() => { statusMsg.innerText = ""; }, 3000);
        } else {
            statusMsg.innerText = `❌ Kosa: ${data.error}`;
            statusMsg.style.color = "red";
        }
    } catch (error) {
        statusMsg.innerText = "❌ Kosa la mtandao"; statusMsg.style.color = "red";
    }
});

// 3. Kufuta Shule
async function deleteSchool(id) {
    if (!confirm("Je, una uhakika unataka kufuta shule hii? Kitendo hiki hakiwezi kurudishwa.")) return;

    try {
        const response = await fetch(`/api/schools/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            loadSchools();
        } else {
            const data = await response.json();
            alert(`Imeshindikana kufuta: ${data.error}`);
        }
    } catch (error) {
        console.error(error);
        alert("Kosa la mtandao.");
    }
}