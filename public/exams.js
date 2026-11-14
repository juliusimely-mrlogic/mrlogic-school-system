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

async function loadDropdownData() {
    try {
        const examsRes = await fetch('/api/exams', { headers: { 'Authorization': `Bearer ${token}` } });
        const exams = await examsRes.json();
        const examSelect = document.getElementById('exam-select');
        examSelect.innerHTML = '<option value="">-- Chagua Mtihani --</option>';
        exams.forEach(exam => {
            examSelect.innerHTML += `<option value="${exam.id}">${exam.name}</option>`;
        });

        const subjectsRes = await fetch('/api/subjects', { headers: { 'Authorization': `Bearer ${token}` } });
        const subjects = await subjectsRes.json();
        const subjectSelect = document.getElementById('subject-select');
        subjectSelect.innerHTML = '<option value="">-- Chagua Somo --</option>';
        subjects.forEach(sub => {
            subjectSelect.innerHTML += `<option value="${sub.id}">${sub.name}</option>`;
        });

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
        const response = await fetch(`/api/students?stream_id=${streamId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const students = await response.json();

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
                        <input type="number" name="score_${student.id}" placeholder="">
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

    const marksData = [];
    const inputs = document.querySelectorAll('input[type="number"]');
    let hasError = false;

    // Kagua alama kabla ya kutuma
    inputs.forEach(input => {
        if (input.value !== '') {
            const val = parseFloat(input.value);
            if (val < 0 || val > 100) {
                input.style.border = '2px solid red';
                hasError = true;
            } else {
                input.style.border = '1px solid #ccc';
            }
        } else {
            input.style.border = '1px solid #ccc';
        }
    });

    if (hasError) {
        alert("Tafadhali ingiza alama kati ya 0 na 100 pekee.");
        statusMsg.innerText = "";
        return;
    }

    // Kusanya alama
    inputs.forEach(input => {
        const studentId = input.name.split('_')[1]; 
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
        } else {
            statusMsg.innerText = `❌ Kosa: ${data.error || 'Imeshindikana'}`;
            statusMsg.style.color = 'red';
        }
    } catch (error) {
        console.error("Kosa la mtandao:", error);
        statusMsg.innerText = "❌ Kosa la mtandao";
        statusMsg.style.color = "red";
    }
});