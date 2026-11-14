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

async function loadBroadsheet() {
    const exam_id = document.getElementById('exam-select').value;
    const stream_id = document.getElementById('stream-select').value;
    const container = document.getElementById('report-container');
    const btnPrint = document.getElementById('btn-print');

    if (!exam_id || !stream_id) {
        alert("Tafadhali chagua mtihani na darasa!");
        return;
    }

    // Chukua majina kwa ajili ya print header
    const examName = document.getElementById('exam-select').options[document.getElementById('exam-select').selectedIndex].text;
    const streamName = document.getElementById('stream-select').options[document.getElementById('stream-select').selectedIndex].text;
    document.getElementById('print-exam-name').innerText = examName;
    document.getElementById('print-stream-name').innerText = streamName;
    
    // Njia rahisi ya kupata jina la shule (kutoka kwenye local storage)
    const user = JSON.parse(userStr);
    document.getElementById('print-school-name').innerText = user.school_name || "SHULE YAKO";

    container.innerHTML = `<p style="text-align: center;">Inatafuta ripoti...</p>`;

    try {
        const response = await fetch(`/api/reports/broadsheet?exam_id=${exam_id}&stream_id=${stream_id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Imeshindwa kuleta ripoti");

        const data = await response.json();
        
        if (data.reportData.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: red;">Hakuna alama zilizowekwa kwa darasa hili kwenye mtihani huu.</p>`;
            btnPrint.style.display = 'none';
            return;
        }

        let tableHeaders = `<th>NAFASI</th><th>JINA KAMILI</th>`;
        data.subjects.forEach(sub => {
            tableHeaders += `<th>${sub.name.substring(0, 3).toUpperCase()}</th>`;
        });
        tableHeaders += `<th>TOTAL</th><th>AVERAGE</th>`;

        let tableRows = '';
        data.reportData.forEach(row => {
            let scoresHtml = '';
            data.subjects.forEach(sub => {
                const score = row.scores[sub.id];
                scoresHtml += `<td>${score}</td>`;
            });

            tableRows += `
                <tr>
                    <td class="pos-col">${row.position}</td>
                    <td>${row.full_name}</td>
                    ${scoresHtml}
                    <td class="total-col">${row.total}</td>
                    <td class="avg-col">${row.average}%</td>
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