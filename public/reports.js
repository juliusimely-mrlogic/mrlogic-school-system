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
    const btnExport = document.getElementById('btn-export');
    const btnRelease = document.getElementById('btn-release');

    if (!exam_id || !stream_id) {
        alert("Tafadhali chagua mtihani na darasa!");
        return;
    }

    const examName = document.getElementById('exam-select').options[document.getElementById('exam-select').selectedIndex].text;
    const streamName = document.getElementById('stream-select').options[document.getElementById('stream-select').selectedIndex].text;
    document.getElementById('print-exam-name').innerText = examName;
    document.getElementById('print-stream-name').innerText = streamName;
    
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
            btnExport.style.display = 'none';
            btnRelease.style.display = 'none';
            return;
        }

        // Vichwa vya Jedwali
        let tableHeaders = `<th>NAFASI</th><th>JINA KAMILI</th><th>JINSIA</th><th>MKONDO</th><th>TOTAL</th><th>WASTANI</th><th>POINTI</th><th>DIV</th><th>MASOMO (SUBJECTS)</th>`;

        let tableRows = '';
        data.reportData.forEach(row => {
            let subjectsStr = '';
            // Chakarata masomo yote
            data.subjects.forEach(sub => {
                const subData = row.scores[sub.id];
                const code = sub.name.substring(0, 3).toUpperCase(); // Herufi 3 za mwanzo (mfano PHY, BIO)
                if (subData && subData.score !== null) {
                    subjectsStr += `<span class="subject-badge">${code}-"${subData.grade}"</span> `;
                } else {
                    subjectsStr += `<span class="subject-badge">${code}-"X"</span> `; // X kwa wasiofanya
                }
            });

            tableRows += `
                <tr class="light-yellow-row">
                    <td class="pos-col">${row.position}</td>
                    <td>${row.full_name}</td>
                    <td>${row.gender}</td>
                    <td>${data.streamName}</td>
                    <td style="font-weight:bold;">${row.total}</td>
                    <td>${row.average}%</td>
                    <td>${row.points}</td>
                    <td>${row.division}</td>
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

        // Onyesha vitufe kulingana na Role na Hali
        btnPrint.style.display = 'inline-block';
        
        if (user.role === 'mtaaluma_mkuu' || user.role === 'super_admin') {
            btnExport.style.display = 'inline-block';
            if (data.is_locked) {
                btnRelease.style.display = 'inline-block';
                btnRelease.innerText = "Matokeo Yamefungwa ✓";
                btnRelease.disabled = true;
                btnRelease.style.backgroundColor = '#9ca3af'; // Kijivu
            } else {
                btnRelease.style.display = 'inline-block';
                btnRelease.innerText = "Achilia Matokeo";
                btnRelease.disabled = false;
                btnRelease.style.backgroundColor = '#ef4444';
            }
        } else {
            btnExport.style.display = 'none';
            btnRelease.style.display = 'none';
        }

    } catch (error) {
        console.error("Kosa:", error);
        container.innerHTML = `<p style="text-align: center; color: red;">Kuna tatizo limetokea wakati wa kuleta ripoti.</p>`;
    }
}

// Kazi ya Kuachia Matokeo
async function releaseResults() {
    const exam_id = document.getElementById('exam-select').value;
    if (!exam_id) return;

    if (!confirm("Je, una uhakika unataka kuachia matokeo haya? Walimu hawataweza kubadilisha alama tena.")) return;

    try {
        const response = await fetch(`/api/exams/${exam_id}/lock`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            alert("Matokeo yamefungwa kikamilifu! Walimu hawawezi kubadilisha alama tena.");
            loadBroadsheet(); // Refresh ili kitufe kibadilike
        } else {
            const data = await response.json();
            alert(`Kosa: ${data.error}`);
        }
    } catch (error) {
        console.error(error);
        alert("Kosa la mtandao.");
    }
}

// Kazi ya Kupakua Excel
async function exportToExcel() {
    const exam_id = document.getElementById('exam-select').value;
    if (!exam_id) {
        alert("Chagua mtihani kwanza!");
        return;
    }

    try {
        const response = await fetch(`/api/reports/export-excel/${exam_id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Alama_Mtihani_${exam_id}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

    } catch (error) {
        console.error(error);
        alert(`Kosa: ${error.message}`);
    }
}