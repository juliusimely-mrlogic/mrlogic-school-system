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
    loadExams();
});

async function loadExams() {
    try {
        const examsRes = await fetch('/api/exams', { headers: { 'Authorization': `Bearer ${token}` } });
        const exams = await examsRes.json();
        const examSelect = document.getElementById('exam-select');
        examSelect.innerHTML = '<option value="">-- Chagua Mtihani --</option>';
        exams.forEach(exam => {
            examSelect.innerHTML += `<option value="${exam.id}">${exam.name}</option>`;
        });
    } catch (error) {
        console.error("Kosa la kupakia data:", error);
    }
}

async function loadFStudents() {
    const exam_id = document.getElementById('exam-select').value;
    const container = document.getElementById('report-container');
    const btnPrint = document.getElementById('btn-print');
    const totalFCard = document.getElementById('total-f-card');
    const totalFCount = document.getElementById('total-f-count');

    if (!exam_id) {
        alert("Tafadhali chagua mtihani kwanza!");
        return;
    }

    const examName = document.getElementById('exam-select').options[document.getElementById('exam-select').selectedIndex].text;
    document.getElementById('print-exam-name').innerText = examName;
    document.getElementById('print-school-name').innerText = user.school_name || "SHULE YAKO";

    container.innerHTML = `<p style="text-align: center;">Inatafuta ripoti...</p>`;

    try {
        const response = await fetch(`/api/reports/all-f-students?exam_id=${exam_id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Imeshindwa kuleta ripoti");

        const data = await response.json();
        
        // Onyesha kadi ya Jumla ya F
        totalFCard.style.display = 'block';
        totalFCount.innerText = data.totalFsInSchool;

        if (data.reportData.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: #10b981; font-weight: bold;">Hongera! Hakuna mwanafunzi aliyepata F kwenye masomo yote.</p>`;
            btnPrint.style.display = 'none';
            return;
        }

        let tableHeaders = `
            <th>NAFASI</th>
            <th>JINA LA MWANAFUNZI</th>
            <th>JINSIA</th>
            <th>MKONDO</th>
            <th>WASTANI</th>
            <th>MASOMO (YOTE F)</th>
        `;

        let tableRows = '';
        data.reportData.forEach(row => {
            let subjectsStr = '';
            row.subjects.forEach(sub => {
                subjectsStr += `<span class="subject-badge">${sub.code}-"${sub.grade}"</span> `;
            });

            tableRows += `
                <tr>
                    <td class="pos-col">${row.rank}</td>
                    <td>${row.name}</td>
                    <td>${row.gender}</td>
                    <td>${row.stream_name}</td>
                    <td>${row.average}%</td>
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