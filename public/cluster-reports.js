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
        streams.forEach(stream => {
            streamSelect.innerHTML += `<option value="${stream.id}">${stream.name}</option>`;
        });
    } catch (error) {
        console.error("Kosa la kupakia data:", error);
    }
}

async function loadClusterStudents() {
    const exam_id = document.getElementById('exam-select').value;
    const stream_id = document.getElementById('stream-select').value;
    const cluster = document.getElementById('cluster-select').value;
    const container = document.getElementById('report-container');
    const btnPrint = document.getElementById('btn-print');

    if (!exam_id) {
        alert("Tafadhali chagua mtihani kwanza!");
        return;
    }

    const examName = document.getElementById('exam-select').options[document.getElementById('exam-select').selectedIndex].text;
    const streamName = document.getElementById('stream-select').options[document.getElementById('stream-select').selectedIndex].text;
    const clusterName = document.getElementById('cluster-select').options[document.getElementById('cluster-select').selectedIndex].text;
    
    document.getElementById('print-exam-name').innerText = examName;
    document.getElementById('print-stream-name').innerText = streamName;
    document.getElementById('print-cluster-name').innerText = clusterName;
    
    const user = JSON.parse(userStr);
    document.getElementById('print-school-name').innerText = user.school_name || "SHULE YAKO";

    container.innerHTML = `<p style="text-align: center;">Inatafuta ripoti...</p>`;

    try {
        let url = `/api/reports/cluster-top-students?exam_id=${exam_id}&cluster=${cluster}`;
        if (stream_id) url += `&stream_id=${stream_id}`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Imeshindwa kuleta ripoti");

        const data = await response.json();
        
        if (data.reportData.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: red;">Hakuna data ya kutosha kwa vigezo ulivyochagua.</p>`;
            btnPrint.style.display = 'none';
            return;
        }

        let tableHeaders = `
            <th>NAFASI</th>
            <th>JINA LA MWANAFUNZI</th>
            <th>JINSIA</th>
            <th>KIDATO/MKONDO</th>
            <th>WASTANI</th>
            <th>MASOMO (SUBJECTS)</th>
        `;

        let tableRows = '';
        data.reportData.forEach(row => {
            let subjectsStr = '';
            Object.keys(row.subjects_detail).forEach(subName => {
                const sub = row.subjects_detail[subName];
                const code = subName.substring(0, 3).toUpperCase();
                subjectsStr += `<span class="subject-badge">${code}-"${sub.score}"</span> `;
            });

            tableRows += `
                <tr>
                    <td class="pos-col">${row.rank}</td>
                    <td>${row.full_name}</td>
                    <td>${row.gender}</td>
                    <td>${row.stream_name}</td>
                    <td class="avg-col">${row.average}%</td>
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