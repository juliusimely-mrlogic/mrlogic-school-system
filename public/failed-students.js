const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');

if (!token || !userStr) {
    window.location.replace('/login.html');
}

const user = JSON.parse(userStr);

function logout() {
    localStorage.clear();
    window.location.replace('/login.html');
}

document.addEventListener('DOMContentLoaded', () => {
    loadInitialData();
});

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
        streams.forEach(stream => {
            streamSelect.innerHTML += `<option value="${stream.id}">${stream.name}</option>`;
        });

    } catch (error) {
        console.error("Kosa la kupakia data:", error);
    }
}

async function loadFailedStudents() {
    const exam_id = document.getElementById('exam-select').value;
    const stream_id = document.getElementById('stream-select').value;
    const container = document.getElementById('report-container');
    const statsContainer = document.getElementById('stats-container');
    const btnPrint = document.getElementById('btn-print');

    if (!exam_id) {
        alert("Tafadhali chagua mtihani kwanza!");
        return;
    }

    // Weka vichwa vya print
    const examName = document.getElementById('exam-select').options[document.getElementById('exam-select').selectedIndex].text;
    const streamName = document.getElementById('stream-select').options[document.getElementById('stream-select').selectedIndex].text;
    
    document.getElementById('print-exam-name').innerText = examName;
    document.getElementById('print-stream-name').innerText = streamName || "Shule Nzima";
    document.getElementById('print-school-name').innerText = user.school_name || "SHULE YAKO";

    container.innerHTML = `<p style="text-align: center;">Inatafuta ripoti...</p>`;

    try {
        let url = `/api/reports/failed-students?exam_id=${exam_id}`;
        if (stream_id) url += `&stream_id=${stream_id}`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Imeshindwa kuleta ripoti");

        const data = await response.json();
        
        // Onyesha Jumla ya F
        statsContainer.style.display = 'grid';
        document.getElementById('stat-total-f').innerText = data.totalFs;

        if (data.failedStudents.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: green; font-weight: bold;">Hongera! Hakuna mwanafunzi aliyepata F kwenye masomo yote.</p>`;
            btnPrint.style.display = 'none';
            return;
        }

        let tableHeaders = `
            <th>NAFASI</th>
            <th>JINA LA MWANAFUNZI</th>
            <th>JINSIA</th>
            <th>KIDATO/MKONDO</th>
            <th>MASOMO YALIYOFELIWA (F)</th>
        `;

        let tableRows = '';
        data.failedStudents.forEach(row => {
            let subjectsStr = '';
            row.failed_subjects.forEach(sub => {
                subjectsStr += `<span class="subject-badge">${sub.code}-"${sub.grade}"</span> `;
            });

            tableRows += `
                <tr>
                    <td class="pos-col">${row.rank}</td>
                    <td>${row.full_name}</td>
                    <td>${row.gender}</td>
                    <td>${row.stream_name}</td>
                    <td>${subjectsStr}</td>
                </tr>
            `;
        });

        container.innerHTML = `
            <table>
                <thead><tr>${tableHeaders}</tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
        `;

        btnPrint.style.display = 'inline-block';

    } catch (error) {
        console.error("Kosa:", error);
        container.innerHTML = `<p style="text-align: center; color: red;">Kuna tatizo limetokea wakati wa kuleta ripoti.</p>`;
    }
}