const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');

if (!token || !userStr) {
    window.location.replace('/login.html');
}

function logout() {
    localStorage.clear();
    window.location.replace('/login.html');
}

async function loadTeachers() {
    const tableBody = document.getElementById('teachers-table-body');
    
    try {
        const response = await fetch('/api/teachers', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            localStorage.clear();
            window.location.replace('/login.html');
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const teachers = await response.json();

        if (teachers.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Hakuna walimu waliyosajiliwa kwenye shule hii.</td></tr>`;
            return;
        }

        let html = '';
        teachers.forEach((teacher, index) => {
            // Tunatafuta jina la simu na email kwa uangalifu
            const phone = teacher.phone || teacher.phone_number || teacher.simu || 'Hajajaza';
            const email = teacher.email || teacher.email_address || teacher.barua_pepe || 'Hajajaza';
            const jinsia = teacher.gender || teacher.jinsia || 'Hajajaza';

            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${teacher.full_name || teacher.name || 'Hajajaza'}</td>
                    <td>${jinsia}</td>
                    <td>${phone}</td>
                    <td>${email}</td>
                </tr>
            `;
        });

        tableBody.innerHTML = html;

    } catch (error) {
        console.error("Kosa la mtandao:", error);
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Hitilafu ya mtandao. Hakikisha umeingia vizuri.</td></tr>`;
    }
}

document.addEventListener('DOMContentLoaded', loadTeachers);