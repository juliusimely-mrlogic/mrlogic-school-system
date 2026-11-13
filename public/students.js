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
    loadStreams();
    loadStudents();
});

// 1. Pakia Madarasa kwenye Dropdown
async function loadStreams() {
    const select = document.getElementById('stream_id');
    try {
        const response = await fetch('/api/streams', { headers: { 'Authorization': `Bearer ${token}` } });
        const streams = await response.json();
        
        select.innerHTML = '<option value="">-- Chagua Darasa --</option>';
        streams.forEach(stream => {
            select.innerHTML += `<option value="${stream.id}">${stream.name}</option>`;
        });
    } catch (error) {
        console.error("Kosa la kuleta madarasa:", error);
    }
}

// 2. Pakia Wanafunzi kwenye Jedwali
async function loadStudents() {
    const tableBody = document.getElementById('students-table-body');
    try {
        const response = await fetch('/api/students', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error("Imeshindwa");
        const students = await response.json();

        if (students.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Hakuna wanafunzi.</td></tr>`;
            return;
        }

        let html = '';
        students.forEach((student, index) => {
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${student.admission_number || 'Hajapewa'}</td>
                    <td>${student.full_name}</td>
                    <td>${student.gender || 'Hajajaza'}</td>
                    <td>${student.stream_id || 'Hajapewa'}</td>
                </tr>
            `;
        });
        tableBody.innerHTML = html;
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Kosa la mtandao.</td></tr>`;
    }
}

// 3. Wasilisha Fomu ya Kusajili
document.getElementById('studentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusMsg = document.getElementById('status-msg');
    
    const payload = {
        full_name: document.getElementById('full_name').value,
        admission_number: document.getElementById('admission_number').value,
        gender: document.getElementById('gender').value,
        stream_id: document.getElementById('stream_id').value,
        parent_phone: document.getElementById('parent_phone').value
    };

    statusMsg.innerText = "Inasajili..."; statusMsg.style.color = "blue";

    try {
        const response = await fetch('/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            statusMsg.innerText = "✅ Mwanafunzi amesajiliwa!";
            statusMsg.style.color = "green";
            document.getElementById('studentForm').reset();
            loadStudents(); // Refresh table
            setTimeout(() => { statusMsg.innerText = ""; }, 3000);
        } else {
            statusMsg.innerText = `❌ Kosa: ${data.error}`;
            statusMsg.style.color = "red";
        }
    } catch (error) {
        statusMsg.innerText = "❌ Kosa la mtandao"; statusMsg.style.color = "red";
    }
});