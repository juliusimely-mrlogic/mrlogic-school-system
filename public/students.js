const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');

if (!token || !userStr) {
    window.location.replace('/login.html');
}

let isEditing = false;
let allStreams = []; // Tutahifadhi madarasa hapa
let allStudents = []; // Tutahifadhi wanafunzi hapa

function logout() {
    localStorage.clear();
    window.location.replace('/login.html');
}

document.addEventListener('DOMContentLoaded', () => {
    loadStreams();
    loadStudents();
});

// 1. Pakia Madarasa
async function loadStreams() {
    try {
        const response = await fetch('/api/streams', { headers: { 'Authorization': `Bearer ${token}` } });
        allStreams = await response.json();
        
        // Jaza dropdown ya fomu ya kusajili
        const select = document.getElementById('stream_id');
        select.innerHTML = '<option value="">-- Chagua Darasa --</option>';
        allStreams.forEach(stream => {
            select.innerHTML += `<option value="${stream.id}">${stream.name}</option>`;
        });
    } catch (error) { console.error("Kosa la kuleta madarasa:", error); }
}

// 2. Pakia Wanafunzi na Tengeneza Jedwali
async function loadStudents() {
    const tableBody = document.getElementById('students-table-body');
    try {
        const response = await fetch('/api/students', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error("Imeshindwa");
        allStudents = await response.json();

        if (allStudents.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center;">Hakuna wanafunzi.</td></tr>`;
            return;
        }

        let html = '';
        allStudents.forEach((student, index) => {
            // Tengeneza Dropdown ya Madarasa kwa ajili ya mwanafunzi huyu
            let streamOptions = `<option value="">-- Hajapewa --</option>`;
            allStreams.forEach(stream => {
                const isSelected = student.stream_id === stream.id ? 'selected' : '';
                streamOptions += `<option value="${stream.id}" ${isSelected}>${stream.name}</option>`;
            });

            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${student.admission_number || 'Hajapewa'}</td>
                    <td>${student.full_name}</td>
                    <td>${student.gender || 'Hajajaza'}</td>
                    <td>
                        <!-- Hapa ndipo mabadiliko makubwa yalipo -->
                        <select class="stream-select-table" onchange="assignStudentToStream(${student.id}, this.value, this)">
                            ${streamOptions}
                        </select>
                    </td>
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

// 3. Kazi Mpya: Kubadilisha Darasa la Mwanafunzi Papo Hapo
async function assignStudentToStream(studentId, newStreamId, selectElement) {
    selectElement.disabled = true; // Zima dropdown kidogo isigongwe mara mbili
    const originalBorder = selectElement.style.border;

    try {
        // Tafuta taarifa za mwanafunzi ili tuzitume zote kwenye PUT
        const student = allStudents.find(s => s.id === studentId);
        
        const payload = {
            full_name: student.full_name,
            gender: student.gender,
            admission_number: student.admission_number,
            parent_phone: student.parent_phone,
            stream_id: newStreamId || null // Kama amechagua tupu, iwe null
        };

        const response = await fetch(`/api/students/${studentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            // Onyesha mafanikio kwa kubadilisha rangi ya border
            selectElement.style.border = "2px solid #10b981"; 
            setTimeout(() => { selectElement.style.border = originalBorder; }, 2000);
            
            // Sasisha kumbukumbu yetu ya ndani
            student.stream_id = newStreamId ? parseInt(newStreamId) : null;
        } else {
            alert("Imeshindikana kuweka darasa.");
            selectElement.value = student.stream_id || ""; // Rudisha kwenye hali ya awali
        }
    } catch (error) {
        console.error(error);
        alert("Kosa la mtandao.");
        selectElement.value = ""; // Rudisha
    } finally {
        selectElement.disabled = false;
    }
}

// 4. Kazi za Kawaida (Edit, Delete, Submit, Bulk Upload)
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
    window.scrollTo(0, 0); 
}

function cancelEdit() {
    isEditing = false;
    document.getElementById('form-title').innerText = "Sajili Mwanafunzi Mpya (Mmoja)";
    document.getElementById('studentForm').reset();
    document.getElementById('student_id').value = '';
    document.getElementById('btn-submit').innerText = "Sajili Mwanafunzi";
    document.getElementById('btn-cancel').style.display = 'none';
}

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
            cancelEdit(); 
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

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('excelFile');
    const file = fileInput.files[0];
    const statusSpan = document.getElementById('upload-status');
    const errorList = document.getElementById('upload-errors');

    if (!file) {
        alert("Tafadhali chagua faili la Excel kwanza!");
        return;
    }

    statusSpan.innerText = "Inapakia... Tafadhali subiri.";
    statusSpan.style.color = "blue";
    errorList.innerHTML = "";

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/students/bulk', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            statusSpan.innerText = `✅ ${data.message}`;
            statusSpan.style.color = "green";
            fileInput.value = ""; 
            loadStudents(); 

            if (data.errors && data.errors.length > 0) {
                data.errors.forEach(err => {
                    const li = document.createElement('li');
                    li.innerText = err;
                    errorList.appendChild(li);
                });
            }
        } else {
            statusSpan.innerText = `❌ Kosa: ${data.error || 'Imeshindikana'}`;
            statusSpan.style.color = "red";
        }
    } catch (error) {
        console.error("Kosa la kupakia:", error);
        statusSpan.innerText = "❌ Kosa la mtandao.";
        statusSpan.style.color = "red";
    }
});