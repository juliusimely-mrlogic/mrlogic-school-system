// Nje ya login function, ongeza hizi:
let currentUserRole = localStorage.getItem('user_role');

// Ndani ya showDashboard(), ongeza hizi:
if (currentUserRole === 'SUPER_ADMIN') {
    document.getElementById('superadmin-dashboard').style.display = 'block';
    fetchSuperAdminStats();
}

// Kazi mpya ya kuvuta takwimu:
async function fetchSuperAdminStats() {
    const res = await fetch(`${API_BASE}/superadmin/stats`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    if(res.ok) {
        document.getElementById('sa-schools').innerText = data.totalSchools;
        document.getElementById('sa-districts').innerText = data.totalDistricts;
        document.getElementById('sa-students').innerText = data.totalStudents;
        document.getElementById('sa-fees').innerText = 'Tsh ' + data.totalSystemFees.toLocaleString();
    }
}

// Kwenye school-form submit, ongeza logic ya levels:
document.getElementById('school-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Chukua levels zilizochaguliwa
    const schoolLevels = [];
    if(document.getElementById('lvl-primary').checked) schoolLevels.push('PRIMARY');
    if(document.getElementById('lvl-olevel').checked) schoolLevels.push('O_LEVEL');
    if(document.getElementById('lvl-alevel').checked) schoolLevels.push('A_LEVEL');

    const body = {
        name: document.getElementById('school-name').value, 
        code: document.getElementById('school-code').value,
        region: document.getElementById('school-region').value, 
        district: document.getElementById('school-district').value,
        ward: document.getElementById('school-ward').value, 
        exam_center_no: document.getElementById('school-exam-no').value,
        headmaster_name: document.getElementById('school-headmaster').value, 
        ownership: document.getElementById('school-ownership').value,
        language: document.getElementById('school-language').value, 
        schoolLevels: schoolLevels // Tunatuma hizi kwenye API
    };
    // ... (endelea na fetch kama ilivyokuwa)
});