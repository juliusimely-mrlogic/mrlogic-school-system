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
    loadDropdownData();
});

// 1. Pakia Mitihani, Masomo na Madarasa kwenye Dropdown
async function loadDropdownData() {
    try {
        // Pakia Mitihani
        const examsRes = await fetch('/api/exams', { headers: { 'Authorization': `Bearer ${token}` } });
        const exams = await examsRes.json();
        const examSelect = document.getElementById('exam-select');
        examSelect.innerHTML = '<option value="">-- Chagua Mtihani --</option>';
        exams.forEach(exam => {
            examSelect.innerHTML += `<option value="${exam.id}">${exam.name}</option>`;
        });

        // Pakia Masomo
        const subjectsRes = await fetch('/api/subjects', { headers: { 'Authorization': `Bearer ${token}` } });
        const subjects = await subjectsRes.json();
        const subjectSelect = document.getElementById('subject-select');
        subjectSelect.innerHTML = '<option value="">-- Chagua Somo --</option>';
        subjects.forEach(sub => {
            subjectSelect.innerHTML += `<option value="${sub.id}">${sub.name}</option>`;
        });

        // Pakia Madarasa
        const streamsRes = await fetch('/api/streams', { headers: { 'Authorization': `Bearer ${token}` } });
        const streams = await streamsRes.json();
        const streamSelect = document.getElementById('stream-select');
        streamSelect.innerHTML = '<option value="">-- Chagua Darasa --</option>';
        streams.forEach(stream => {
            streamSelect.innerHTML += `<option value="${stream.id}">${stream.name}</option>`;
        });

    } catch (error) {
        console.error("Kosa la kupakia data:", error);
    }
}

// 2. Pakia Wanafunzi wa Darasa Husika
async function loadStudentsForMarks() {
    const streamId = document.getElementById('stream-select').value;
    const tableBody = document.getElementById('marks-table-body');
    const btnSubmit = document.getElementById('btn-submit-marks');

    if (!streamId) {
        alert("Tafadhali chagua darasa kwanza!");
        return;
    }

    tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center;">Inapakia wanafunzi...</td></tr>`;

    try {
        const response = await fetch('/api/students', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        let students = await response.json();
        
        // Chuja wanafunzi wa darasa husika tu
        students = students.filter(s => s.stream_id == streamId);

        if (students.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center;">Hakuna wanafunzi kwenye darasa hili.</td></tr>`;
            btnSubmit.style.display = 'none';
            return;
        }

        let html = '';
        students.forEach((student, index) => {
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${student.full_name}</td>
                    <td>
                        <input type="number" name="score_${student.id}" min="0" max="100" placeholder="0 - 100">
                    </td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = html;
        btnSubmit.style.display = 'block';

    } catch (error) {
        console.error("Kosa la kuleta wanafunzi:", error);
        tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: red;">Kosa la mtandao.</td></tr>`;
    }
}

// 3. Hifadhi Alama
document.getElementById('marksForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const exam_id = document.getElementById('exam-select').value;
    const subject_id = document.getElementById('subject-select').value;
    const statusMsg = document.getElementById('status-msg');
    
    if (!exam_id || !subject_id) {
        alert("Tafadhali chagua mtihani na somo!");
        return;
    }

    statusMsg.innerText = "Inahifadhi alama...";
    statusMsg.style.color = "blue";

    // Kusanya alama zote zilizoingizwa
    const marksData = [];
    const inputs = document.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
        const studentId = input.name.split('_')[1]; // Tunatoa ID kutoka kwenye jina la input (score_1)
        if (input.value !== '') {
            marksData.push({
                student_id: studentId,
                score: input.value
            });
        }
    });

    if (marksData.length === 0) {
        alert("Tafadhali ingiza alama za angalau mwanafunzi mmoja.");
        statusMsg.innerText = "";
        return;
    }

    try {
        const response = await fetch('/api/results', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ exam_id, subject_id, marks: marksData })
        });

        const data = await response.json();

        if (response.ok) {
            statusMsg.innerText = "✅ Alama zimehifadhiwa!";
            statusMsg.style.color = "green";
            setTimeout(() => { statusMsg.innerText = ""; }, 3000);
            // Unaweza kuamua kutvfuta inputs hapa kama unataka
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