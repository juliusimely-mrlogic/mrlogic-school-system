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

// 1. Pakia Mitihani na Madarasa kwenye Dropdown
async function loadInitialData() {
    try {
        // Pakia Mitihani
        const examsRes = await fetch('/api/exams', { headers: { 'Authorization': `Bearer ${token}` } });
        const exams = await examsRes.json();
        const examSelect = document.getElementById('exam-select');
        examSelect.innerHTML = '<option value="">-- Chagua Mtihani --</option>';
        exams.forEach(exam => {
            examSelect.innerHTML += `<option value="${exam.id}">${exam.name}</option>`;
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

// 2. Pakia Wanafunzi Kulingana na Darasa Lililochaguliwa
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

// 3. Tengeneza Ripoti
async function loadReportCard() {
    const exam_id = document.getElementById('exam-select').value;
    const student_id = document.getElementById('student-select').value;
    
    if (!exam_id || !student_id) {
        alert("Tafadhali chagua mtihani na mwanafunzi!");
        return;
    }

    // Chukua majina ya mtihani kwa ajili ya kuonyesha
    const examName = document.getElementById('exam-select').options[document.getElementById('exam-select').selectedIndex].text;

    try {
        const response = await fetch(`/api/reports/student/${student_id}?exam_id=${exam_id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Imeshindwa kuleta taarifa");
        
        const data = await response.json();

        // Weka Header Info
        document.getElementById('school-name-display').innerText = data.schoolName;
        document.getElementById('student-name-display').innerText = data.student.full_name;
        document.getElementById('student-adm-display').innerText = data.student.admission_number || '-';
        document.getElementById('student-stream-display').innerText = data.streamName;
        document.getElementById('exam-name-display').innerText = examName;

        // Weka Alama za Masomo
        const tableBody = document.querySelector('#subjects-table tbody');
        let html = '';
        data.scores.forEach(score => {
            // Rangi ya Grade kwenye screen (Haitatokea kwenye print)
            let gradeColor = 'black';
            if (score.grade === 'A') gradeColor = 'green';
            if (score.grade === 'F') gradeColor = 'red';

            html += `
                <tr>
                    <td>${score.name}</td>
                    <td>${score.score}</td>
                    <td style="font-weight: bold; color: ${gradeColor};">${score.grade}</td>
                </tr>
            `;
        });
        tableBody.innerHTML = html;

        // Weka Summary
        document.getElementById('total-display').innerText = data.total;
        document.getElementById('average-display').innerText = data.average + '%';
        document.getElementById('position-display').innerText = `${data.position} kati ya ${data.totalInClass}`;

        // Onyesha Report Card na Kitufe cha Print
        document.getElementById('report-card-container').style.display = 'block';
        document.getElementById('btn-print').style.display = 'inline-block';

    } catch (error) {
        console.error("Kosa:", error);
        alert("Kuna tatizo limetokea wakati wa kuleta ripoti. Hakikisha alama za mwanafunzi huyu zimeingizwa.");
    }
}