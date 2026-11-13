const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');

if (!token || !userStr) {
    window.location.replace('/login.html');
}

function logout() {
    localStorage.clear();
    window.location.replace('/login.html');
}

// Kama ni super admin, ficha dropdown ya shule kwa default
function toggleSchoolSelect() {
    const role = document.getElementById('role').value;
    const schoolGroup = document.getElementById('school-group');
    if (role === 'super_admin') {
        schoolGroup.style.display = 'none';
    } else {
        schoolGroup.style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    toggleSchoolSelect(); // Fanya kazi mara ya kwanza
    loadSchools();
    loadUsers();
});

// 1. Pakia Shule kwenye Dropdown
async function loadSchools() {
    const select = document.getElementById('school_id');
    try {
        const response = await fetch('/api/schools', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const schools = await response.json();
        
        select.innerHTML = '<option value="">-- Chagua Shule --</option>';
        schools.forEach(school => {
            const option = document.createElement('option');
            option.value = school.id;
            option.text = school.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Kosa la kuleta shule:", error);
    }
}

// 2. Pakia Watumiaji Waliopo
async function loadUsers() {
    const tableBody = document.getElementById('users-table-body');
    try {
        const response = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Imeshindwa kuleta watumiaji");

        const users = await response.json();

        if (users.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Hakuna watumiaji waliyosajiliwa.</td></tr>`;
            return;
        }

        let html = '';
        users.forEach((user, index) => {
            let roleBadge = '';
            if(user.role === 'super_admin') roleBadge = '<span style="background:#ef4444; color:white; padding:3px 8px; border-radius:4px; font-size:12px;">Super Admin</span>';
            else if(user.role === 'school_manager') roleBadge = '<span style="background:#3b82f6; color:white; padding:3px 8px; border-radius:4px; font-size:12px;">Mkuu wa Shule</span>';
            else if(user.role === 'mtaaluma_mkuu') roleBadge = '<span style="background:#a855f7; color:white; padding:3px 8px; border-radius:4px; font-size:12px;">Mtaaluma Mkuu</span>';
            else if(user.role === 'teacher') roleBadge = '<span style="background:#10b981; color:white; padding:3px 8px; border-radius:4px; font-size:12px;">Mwalimu</span>';

            html += `
                <tr>
                    <td>${user.id}</td>
                    <td>${user.full_name}</td>
                    <td>${user.username}</td>
                    <td>${roleBadge}</td>
                    <td>${user.school_name || 'N/A (System)'}</td>
                </tr>
            `;
        });

        tableBody.innerHTML = html;

    } catch (error) {
        console.error(error);
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Kuna tatizo limetokea wakati wa kuleta watumiaji.</td></tr>`;
    }
}

// 3. Wasilisha Fomu ya Kuoangeza Mtumiaji
document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const full_name = document.getElementById('full_name').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;
    const school_id = document.getElementById('school_id').value;
    const statusMsg = document.getElementById('status-msg');

    if (role !== 'super_admin' && !school_id) {
        alert("Tafadhali chagua shule kwa ajili ya mtumiaji huyu!");
        return;
    }

    statusMsg.innerText = "Inasajili...";
    statusMsg.style.color = "blue";

    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ full_name, username, password, role, school_id })
        });

        const data = await response.json();

        if (response.ok) {
            statusMsg.innerText = "✅ Mtumiaji amesajiliwa kikamilifu!";
            statusMsg.style.color = "green";
            document.getElementById('userForm').reset();
            toggleSchoolSelect();
            loadUsers(); // Refresh orodha
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