const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');

if (!token || !userStr) {
    window.location.replace('/login.html');
}

let isEditing = false;

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
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">Hakuna walimu.</td></tr>`;
            return;
        }

        let html = '';
        teachers.forEach((teacher, index) => {
            const phone = teacher.phone || teacher.phone_number || 'Hajajaza';
            const jinsia = teacher.gender || 'Hajajaza';
            const username = teacher.username || 'Bado';

            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${teacher.full_name}</td>
                    <td>${jinsia}</td>
                    <td>${phone}</td>
                    <td style="font-weight:bold; color:#1e3a8a;">${username}</td>
                    <td>
                        <button class="action-btn btn-edit" onclick="editTeacher(${teacher.id}, '${teacher.full_name}', '${teacher.gender}', '${teacher.phone || ''}')">Rekebisha</button>
                        <button class="action-btn btn-delete" onclick="deleteTeacher(${teacher.id})">Futa</button>
                    </td>
                </tr>
            `;
        });
        tableBody.innerHTML = html;
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Kosa la mtandao.</td></tr>`;
    }
}

function editTeacher(id, full_name, gender, phone) {
    isEditing = true;
    document.getElementById('form-title').innerText = "Rekebisha Taarifa za Mwalimu";
    document.getElementById('teacher_id').value = id;
    document.getElementById('full_name').value = full_name;
    document.getElementById('gender').value = gender;
    document.getElementById('phone').value = phone;
    
    document.getElementById('btn-submit').innerText = "Hifadhi Marekebisho";
    document.getElementById('btn-cancel').style.display = 'inline-block';
    window.scrollTo(0, 0);
}

function cancelEdit() {
    isEditing = false;
    document.getElementById('form-title').innerText = "Sajili Mwalimu Mpya";
    document.getElementById('teacherForm').reset();
    document.getElementById('teacher_id').value = '';
    document.getElementById('btn-submit').innerText = "Sajili Mwalimu";
    document.getElementById('btn-cancel').style.display = 'none';
}

async function deleteTeacher(id) {
    if (!confirm("Je, una uhakika unataka kumfuta mwalimu huyu?")) return;
    try {
        const response = await fetch(`/api/teachers/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            loadTeachers();
        } else {
            const data = await response.json();
            alert("Kosa: " + data.error);
        }
    } catch (error) { alert("Kosa la mtandao."); }
}

document.getElementById('teacherForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusMsg = document.getElementById('status-msg');
    
    const payload = {
        full_name: document.getElementById('full_name').value,
        gender: document.getElementById('gender').value,
        phone: document.getElementById('phone').value
    };

    const id = document.getElementById('teacher_id').value;
    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing ? `/api/teachers/${id}` : '/api/teachers';

    statusMsg.innerText = isEditing ? "Inahifadhi marekebisho..." : "Inasajili..."; statusMsg.style.color = "blue";

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            if(!isEditing && data.username) {
                statusMsg.innerHTML = `✅ Mwalimu amesajiliwa!<br>Username yake ni: <strong>${data.username}</strong> (Password: password123)`;
            } else {
                statusMsg.innerText = isEditing ? "✅ Marekebisho yamehifadhiwa!" : "✅ Mwalimu amesajiliwa!";
            }
            statusMsg.style.color = "green";
            cancelEdit();
            loadTeachers();
            setTimeout(() => { statusMsg.innerText = ""; }, 8000); 
        } else {
            statusMsg.innerText = `❌ Kosa: ${data.error}`;
            statusMsg.style.color = "red";
        }
    } catch (error) {
        statusMsg.innerText = "❌ Kosa la mtandao"; statusMsg.style.color = "red";
    }
});