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
    loadDistrictRanking();
});

async function loadDistrictRanking() {
    const container = document.getElementById('report-container');
    const statsContainer = document.getElementById('stats-container');
    const districtTitle = document.getElementById('district-title');

    try {
        const response = await fetch('/api/reports/district-ranking', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "Imeshindwa kuleta data");
        }

        const data = await response.json();

        // 1. Weka Jina la Halmashauri
        districtTitle.innerHTML = `<h2>Halmashauri ya: ${data.districtName}</h2>`;

        // 2. Weka Kadi za Nafasi
        let statsHtml = `
            <div class="stat-card bg-blue">
                <h4>Shule Yako (${data.userSchool.name})</h4>
                <h2>Nafasi ya ${data.userSchool.rank} kati ya ${data.totalSchools}</h2>
                <p>GPA: ${data.userSchool.gpa} - ${data.userSchool.grade}</p>
            </div>
            <div class="stat-card bg-green">
                <h4>Shule Bora (Halmashauri)</h4>
                <h2>${data.bestSchool.name}</h2>
                <p>GPA: ${data.bestSchool.gpa} - ${data.bestSchool.grade}</p>
            </div>
            <div class="stat-card bg-red">
                <h4>Shule Dhaifu (Halmashauri)</h4>
                <h2>${data.worstSchool.name}</h2>
                <p>GPA: ${data.worstSchool.gpa} - ${data.worstSchool.grade}</p>
            </div>
        `;
        statsContainer.innerHTML = statsHtml;

        // 3. Weka Jedwali la Wanafunzi 20 Bora
        if (data.topStudents.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: red;">Hakuna data ya wanafunzi kwa sasa.</p>`;
            return;
        }

        let tableHeaders = `
            <th>NAFASI</th>
            <th>JINA LA MWANAFUNZI</th>
            <th>JINSIA</th>
            <th>SHULE</th>
            <th>KIDATO</th>
            <th>WASTANI</th>
            <th>POINTI</th>
            <th>DIV</th>
            <th>MASOMO (SUBJECTS)</th>
        `;

        let tableRows = '';
        data.topStudents.forEach(row => {
            let subjectsStr = '';
            row.subjects.forEach(sub => {
                subjectsStr += `<span class="subject-badge">${sub.code}-"${sub.grade}"</span> `;
            });

            tableRows += `
                <tr>
                    <td class="pos-col">${row.rank}</td>
                    <td>${row.name}</td>
                    <td>${row.gender}</td>
                    <td>${row.school_name}</td>
                    <td>${row.stream_name}</td>
                    <td style="font-weight: bold; color: #1e3a8a;">${row.average}%</td>
                    <td>${row.points}</td>
                    <td style="font-weight: bold;">${row.division}</td>
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

    } catch (error) {
        console.error("Kosa:", error);
        districtTitle.innerHTML = `<h2 style="color: red;">Kosa</h2>`;
        statsContainer.innerHTML = "";
        container.innerHTML = `<p style="text-align: center; color: red;">${error.message}</p>`;
    }
}