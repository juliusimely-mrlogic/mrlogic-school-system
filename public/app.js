// (Weka code yote ya mwanzo ya app.js hapa, kama ilivyokuwa kwenye Awamu 3, kisha ongeza hizi chini)

// 8. BROADSHEET NA UTHIBITISHO (PUBLISH)
async function loadBroadsheet() {
    const examId = document.getElementById('process-exam-select').value;
    if (!examId) return alert("Chagua mtihani kwanza!");
    try {
        const res = await fetch(`${API_BASE}/exams/processed/${examId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) return alert(data.error);

        document.getElementById('broadsheet-container').style.display = 'block';
        document.getElementById('analytics-container').style.display = 'block';
        
        // Angalia kama imethibitishwa
        if (data.exam.is_published === 0) {
            document.getElementById('publish-container').style.display = 'block';
            document.getElementById('unpublished-warning').style.display = 'block';
        } else {
            document.getElementById('publish-container').style.display = 'none';
            document.getElementById('unpublished-warning').style.display = 'none';
        }

        document.getElementById('broadsheet-title').innerText = `MATOKEO: ${data.exam.name.toUpperCase()} - ${data.exam.term.toUpperCase()}`;

        // Jaza Broadsheet
        const tbody = document.getElementById('broadsheet-body');
        tbody.innerHTML = '';
        data.results.forEach(r => {
            tbody.innerHTML += `<tr><td><strong>${r.rank}</strong></td><td>${r.admission_number}</td><td class="name-col">${r.full_name}</td><td>${r.gender}</td><td>${r.totalMarks}</td><td><strong>${r.aggregatePoints}</strong></td><td>${r.gpa}</td><td><strong>${r.division}</strong></td></tr>`;
        });

        // Jaza Uchambuzi (Top/Bottom/Subjects)
        const results = data.results;
        document.getElementById('top-20-list').innerHTML = results.slice(0, 20).map(r => `<li>${r.full_name} - Pointi: ${r.aggregatePoints}, GPA: ${r.gpa}</li>`).join('') || '<li>Hakuna data.</li>';
        document.getElementById('bottom-20-list').innerHTML = [...results].reverse().slice(0, 20).map(r => `<li>${r.full_name} - Pointi: ${r.aggregatePoints}, GPA: ${r.gpa}</li>`).join('') || '<li>Hakuna data.</li>';
        
        const fStudents = results.filter(r => r.subjects.filter(s => s.grade === 'F').length >= 3);
        document.getElementById('f-list').innerHTML = fStudents.map(r => `<li>${r.full_name} (Ana F: ${r.subjects.filter(s => s.grade === 'F').length})</li>`).join('') || '<li>Hakuna mwanafunzi mwenye F 3+.</li>';

        // Makundi ya Masomo (Simplified for now)
        const getTopByCategory = (cat) => {
             let best = null; let bestPts = 999;
             results.forEach(std => {
                 std.subjects.forEach(s => {
                     const sub = allSubjects.find(x => x.name === s.subject_name);
                     if(sub && sub.category === cat && s.points < bestPts) { bestPts = s.points; best = std.full_name; }
                 });
             });
             return best ? `${best} (Pointi: ${bestPts})` : 'Hakuna data';
        };
        document.getElementById('top-science').innerText = getTopByCategory('SCIENCE');
        document.getElementById('top-business').innerText = getTopByCategory('BUSINESS');
        document.getElementById('top-arts').innerText = getTopByCategory('ARTS');

    } catch (err) { alert("Kosa la kuvuta matokeo: " + err.message); }
}

async function publishResults() {
    const examId = document.getElementById('process-exam-select').value;
    if (!examId) return;
    if (!confirm("Una uhakika unataka kuthibitisha matokeo haya? Baada ya kuthibitisha, hayawezi kubadilishwa tena.")) return;

    try {
        const res = await fetch(`${API_BASE}/exams/${examId}/publish`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
            loadBroadsheet(); // Reload to hide warning
        } else { alert("Kosa: " + data.error); }
    } catch (err) { alert("Hitilafu ya mtandao"); }
}

// 9. UCHAMBUZI WA HALMASHAURI (DISTRICT)
async function loadDistrictAnalytics() {
    const district = document.getElementById('district-name').value;
    if (!district) return alert("Weka jina la Halmashauri!");

    try {
        const res = await fetch(`${API_BASE}/schools/district/${encodeURIComponent(district)}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        
        document.getElementById('district-results').style.display = 'flex';
        
        const topList = document.getElementById('top-schools-list');
        topList.innerHTML = data.top10.map((s, i) => `<li><strong>${s.name}</strong> - Wastani: ${s.avgMarks} (Wanafunzi: ${s.studentsCount})</li>`).join('') || '<li>Hakuna shule.</li>';
        
        const bottomList = document.getElementById('bottom-schools-list');
        bottomList.innerHTML = data.bottom5.map((s, i) => `<li><strong>${s.name}</strong> - Wastani: ${s.avgMarks} (Wanafunzi: ${s.studentsCount})</li>`).join('') || '<li>Hakuna shule.</li>';

    } catch (err) { alert("Kosa la kuvuta uchambuzi wa Halmashauri."); }
}