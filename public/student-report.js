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
    loadInitialData();
});

async function loadInitialData() {
    try {
        const examsRes = await fetch('/api/exams', { headers: { 'Authorization': `Bearer ${token}` } });
        const exams = await examsRes.json();
        const examSelect = document.getElementById('exam-select');
        examSelect.innerHTML = '<option value="">-- Chagua Mtihani --</option>';
        exams.forEach(exam => {
            examSelect.innerHTML += `<option value="${exam.id}">${exam.name}</option>`;
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

async function loadStudentsDropdown() {
    const streamId = document.getElementById('stream-select').value;
    const studentSelect = document.getElementById('student-select');
    
    if (!streamId) {
        studentSelect.innerHTML = '<option value="">-- Chagua Darasa Kwanza --</option>';
        return;
    }

    studentSelect.innerHTML = '<option value="">-- Inapakia... --</option>';

    try {
        const response = await fetch(`/api/students?stream_id=${streamId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const students = await response.json();

        studentSelect.innerHTML = '<option value="">-- Chagua Mwanafunzi --</option>';
        students.forEach(student => {
            studentSelect.innerHTML += `<option value="${student.id}">${student.full_name} (${student.admission_number || 'No Adm'})</option>`;
        });
    } catch (error) {
        console.error("Kosa la kuleta wanafunzi:", error);
    }
}

async function loadReportCard() {
    const exam_id = document.getElementById('exam-select').value;
    const student_id = document.getElementById('student-select').value;
    
    if (!exam_id || !student_id) {
        alert("Tafadhali chagua mtihani na mwanafunzi!");
        return;
    }

    const examName = document.getElementById('exam-select').options[document.getElementById('exam-select').selectedIndex].text;

    try {
        const response = await fetch(`/api/reports/student/${student_id}?exam_id=${exam_id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Imeshindwa kuleta taarifa");
        
        const data = await response.json();

        document.getElementById('school-name-display').innerText = data.schoolName;
        document.getElementById('student-name-display').innerText = data.student.full_name;
        document.getElementById('student-adm-display').innerText = data.student.admission_number || '-';
        document.getElementById('student-stream-display').innerText = data.streamName;
        document.getElementById('exam-name-display').innerText = examName;

        const tableBody = document.querySelector('#subjects-table tbody');
        let html = '';
        data.scores.forEach(score => {
            let gradeColor = 'black';
            if (score.grade === 'A') gradeColor = 'green';
            if (score.grade === 'F') gradeColor = 'red';

            html += `
                <tr>
                    <td>${score.name}</td>
                    <td>${score.score}</td>
                    <td style="font-weight: bold; color: ${gradeColor};">${score.grade}</td>
                    <td>${score.points}</td>
                </tr>
            `;
        });
        tableBody.innerHTML = html;

        document.getElementById('total-display').innerText = data.total;
        document.getElementById('points-display').innerText = data.totalPoints;
        document.getElementById('division-display').innerText = data.division;
        document.getElementById('position-display').innerText = `${data.position} kati ya ${data.totalInClass}`;
        
        const statusEl = document.getElementById('status-display');
        statusEl.innerText = data.status;
        if (data.status === 'PASS') {
            statusEl.className = 'status-pass';
        } else {
            statusEl.className = 'status-inc';
        }

        document.getElementById('report-card-container').style.display = 'block';
        document.getElementById('btn-print').style.display = 'inline-block';

    } catch (error) {
        console.error("Kosa:", error);
        alert("Kuna tatizo limetokea wakati wa kuleta ripoti.");
    }
}