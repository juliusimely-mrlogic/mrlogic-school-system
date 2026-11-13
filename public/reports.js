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

    if (!exam_id || !stream_id) {
        alert("Tafadhali chagua mtihani na darasa!");
        return;
    }

    container.innerHTML = `<p style="text-align: center;">Inatafuta ripoti...</p>`;

    try {
        const response = await fetch(`/api/reports/broadsheet?exam_id=${exam_id}&stream_id=${stream_id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Imeshindwa kuleta ripoti");

        const data = await response.json();
        
        if (data.reportData.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: red;">Hakuna alama zilizowekwa kwa darasa hili kwenye mtihani huu.</p>`;
            return;
        }

        // Tengeneza vichwa vya jedwali (Headers) kwa masomo
        let tableHeaders = `<th>NAFASI</th><th>JINA KAMILI</th>`;
        data.subjects.forEach(sub => {
            tableHeaders += `<th>${sub.name.substring(0, 3).toUpperCase()}</th>`; // Chukua herufi 3 za mwanzo za somo
        });
        tableHeaders += `<th>TOTAL</th><th>AVERAGE</th>`;

        // Tengeneza mistari ya wanafunzi
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

        const tableHtml = `
            <table>
                <thead>
                    <tr>${tableHeaders}</tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        `;

        container.innerHTML = tableHtml;

    } catch (error) {
        console.error("Kosa:", error);
        container.innerHTML = `<p style="text-align: center; color: red;">Kuna tatizo limetokea wakati wa kuleta ripoti.</p>`;
    }
}