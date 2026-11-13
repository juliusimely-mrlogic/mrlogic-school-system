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
    loadDropdowns();
    loadAssignments();
});

// 1. Pakia Dropdowns (Walimu, Madarasa, Masomo)
async function loadDropdowns() {
    try {
        // Walimu
        const teachersRes = await fetch('/api/teachers', { headers: { 'Authorization': `Bearer ${token}` } });
        const teachers = await teachersRes.json();
        const teacherSelect = document.getElementById('teacher_id');
        teacherSelect.innerHTML = '<option value="">-- Chagua Mwalimu --</option>';
        teachers.forEach(t => {
            teacherSelect.innerHTML += `<option value="${t.id}">${t.full_name}</option>`;
        });

        // Madarasa
        const streamsRes = await fetch('/api/streams', { headers: { 'Authorization': `Bearer ${token}` } });
        const streams = await streamsRes.json();
        const streamSelect = document.getElementById('stream_id');
        streamSelect.innerHTML = '<option value="">-- Chagua Darasa --</option>';
        streams.forEach(s => {
            streamSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });

        // Masomo
        const subjectsRes = await fetch('/api/subjects', { headers: { 'Authorization': `Bearer ${token}` } });
        const subjects = await subjectsRes.json();
        const subjectSelect = document.getElementById('subject_id');
        subjectSelect.innerHTML = '<option value="">-- Chagua Somo --</option>';
        subjects.forEach(s => {
            subjectSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });

    } catch (error) {
        console.error("Kosa la kupakia data:", error);
    }
}

// 2. Pakia Assignments Zilizopo
async function loadAssignments() {
    const tableBody = document.getElementById('assignments-table-body');
    try {
        const response = await fetch('/api/assignments', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error("Imeshindwa");
        const data = await response.json();

        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Hakuna walimu waliopangwa bado.</td></tr>`;
            return;
        }

        let html = '';
        data.forEach((item, index) => {
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.teacher_name}</td>
                    <td>${item.stream_name}</td>
                    <td>${item.subject_name}</td>
                    <td>
                        <button class="btn-delete" onclick="deleteAssignment(${item.id})">Futa</button>
                    </td>
                </tr>
            `;
        });
        tableBody.innerHTML = html;

    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Kosa la mtandao.</td></tr>`;
    }
}

// 3. Wasilisha Fomu
document.getElementById('assignmentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusMsg = document.getElementById('status-msg');
    
    const payload = {
        teacher_id: document.getElementById('teacher_id').value,
        stream_id: document.getElementById('stream_id').value,
        subject_id: document.getElementById('subject_id').value
    };

    statusMsg.innerText = "Inahifadhi..."; statusMsg.style.color = "blue";

    try {
        const response = await fetch('/api/assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            statusMsg.innerText = "✅ Mwalimu amepangwa kikamilifu!";
            statusMsg.style.color = "green";
            document.getElementById('assignmentForm').reset();
            loadAssignments();
            setTimeout(() => { statusMsg.innerText = ""; }, 3000);
        } else {
            statusMsg.innerText = `❌ Kosa: ${data.error}`;
            statusMsg.style.color = "red";
        }
    } catch (error) {
        statusMsg.innerText = "❌ Kosa la mtandao"; statusMsg.style.color = "red";
    }
});

// 4. Kufuta Assignment
async function deleteAssignment(id) {
    if (!confirm("Je, una uhakika unataka kufuta hii?")) return;

    try {
        const response = await fetch(`/api/assignments/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            loadAssignments();
        } else {
            alert("Imeshindikana kufuta.");
        }
    } catch (error) {
        console.error(error);
        alert("Kosa la mtandao.");
    }
}