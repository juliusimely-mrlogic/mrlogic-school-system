const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');

if (!token || !userStr) {
    window.location.replace('/login.html');
}

let isEditing = false; // Kufuatilia kama tuko kwenye hali ya kurekebisha

function logout() {
    localStorage.clear();
    window.location.replace('/login.html');
}

document.addEventListener('DOMContentLoaded', () => {
    loadStreams();
    loadStudents();
});

async function loadStreams() {
    const select = document.getElementById('stream_id');
    try {
        const response = await fetch('/api/streams', { headers: { 'Authorization': `Bearer ${token}` } });
        const streams = await response.json();
        select.innerHTML = '<option value="">-- Chagua Darasa --</option>';
        streams.forEach(stream => {
            select.innerHTML += `<option value="${stream.id}">${stream.name}</option>`;
        });
    } catch (error) { console.error("Kosa la kuleta madarasa:", error); }
}

async function loadStudents() {
    const tableBody = document.getElementById('students-table-body');
    try {
        const response = await fetch('/api/students', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error("Imeshindwa");
        const students = await response.json();

        if (students.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">Hakuna wanafunzi.</td></tr>`;
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
                    <td>
                        <button class="action-btn btn-edit" onclick="editStudent(${student.id}, '${student.full_name}', '${student.admission_number}', '${student.gender}', ${student.stream_id}, '${student.parent_phone || ''}')">Rekebisha</button>
                        <button class="action-btn btn-delete" onclick="deleteStudent(${student.id})">Futa</button>
                    </td>
                </tr>
            `;
        });
        tableBody.innerHTML = html;
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">Kosa la mtandao.</td></tr>`;
    }
}

// Kazi ya Kurekebisha (Edit)
function editStudent(id, full_name, admission_number, gender, stream_id, parent_phone) {
    isEditing = true;
    document.getElementById('form-title').innerText = "Rekebisha Taarifa za Mwanafunzi";
    document.getElementById('student_id').value = id;
    document.getElementById('full_name').value = full_name;
    document.getElementById('admission_number').value = admission_number;
    document.getElementById('gender').value = gender;
    document.getElementById('stream_id').value = stream_id || '';
    document.getElementById('parent_phone').value = parent_phone;
    
    document.getElementById('btn-submit').innerText = "Hifadhi Marekebisho";
    document.getElementById('btn-cancel').style.display = 'inline-block';
    window.scrollTo(0, 0); // Peleka juu
}

function cancelEdit() {
    isEditing = false;
    document.getElementById('form-title').innerText = "Sajili Mwanafunzi Mpya";
    document.getElementById('studentForm').reset();
    document.getElementById('student_id').value = '';
    document.getElementById('btn-submit').innerText = "Sajili Mwanafunzi";
    document.getElementById('btn-cancel').style.display = 'none';
}

// Kazi ya Kufuta (Delete)
async function deleteStudent(id) {
    if (!confirm("Je, una uhakika unataka kumfuta mwanafunzi huyu?")) return;
    try {
        const response = await fetch(`/api/students/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            loadStudents();
        } else {
            const data = await response.json();
            alert("Kosa: " + data.error);
        }
    } catch (error) { alert("Kosa la mtandao."); }
}

// Kusimamia Fomu (Submit)
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

    const id = document.getElementById('student_id').value;
    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing ? `/api/students/${id}` : '/api/students';

    statusMsg.innerText = isEditing ? "Inahifadhi marekebisho..." : "Inasajili..."; 
    statusMsg.style.color = "blue";

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            statusMsg.innerText = isEditing ? "✅ Marekebisho yamehifadhiwa!" : "✅ Mwanafunzi amesajiliwa!";
            statusMsg.style.color = "green";
            cancelEdit(); // Safisha fomu
            loadStudents();
            setTimeout(() => { statusMsg.innerText = ""; }, 3000);
        } else {
            statusMsg.innerText = `❌ Kosa: ${data.error}`;
            statusMsg.style.color = "red";
        }
    } catch (error) {
        statusMsg.innerText = "❌ Kosa la mtandao"; statusMsg.style.color = "red";
    }
});