// Chukua taarifa za mtumiaji kutoka localStorage (Kama ulivyoweka kwenye login yako)
const user = JSON.parse(localStorage.getItem('user'));
const token = localStorage.getItem('token');

if (!token || !user) {
    window.location.href = '/login.html'; // Mpeleke kwenye login kama hajalogin
}

// Weka Jina la Mtumiaji
document.getElementById('user-name').innerText = user.name;

// Kazi ya Kuweka Kadi za Menu kulingana na Role
function renderMenu() {
    const menuContainer = document.getElementById('menu-container');
    let html = '';

    if (user.role === 'super_admin' || user.role === 'school_manager') {
        html += `
            <div class="menu-card border-blue"><h3>Wanafunzi</h3><p>Simamia wanafunzi</p></div>
            <div class="menu-card border-red"><h3>Walimu</h3><p>Walimu na Majukumu</p></div>
            <div class="menu-card border-purple"><h3>Madarasa</h3><p>Angalia madarasa</p></div>
            <div class="menu-card border-orange"><h3>Mahudhurio</h3><p>Weka mahudhurio</p></div>
            <div class="menu-card border-blue"><h3>Mitihani & Ripoti</h3><p>Ingiza, chakata, na chapisha</p></div>
            <div class="menu-card border-green"><h3>Usimamizi wa Ada</h3><p>Angalia malipo na madeni</p></div>
            <div class="menu-card border-blue"><h3>Taarifa</h3><p>Tuma na angalia taarifa</p></div>
        `;
    }

    if (user.role === 'super_admin' || user.role === 'school_manager') {
        html += `<div class="menu-card border-purple"><h3>Watumiaji</h3><p>Sajili Wakuru na Walimu</p></div>`;
    }

    if (user.role === 'teacher') {
        html += `
            <div class="menu-card border-blue"><h3>Wanafunzi Wangu</h3><p>Darasa lako</p></div>
            <div class="menu-card border-orange"><h3>Mahudhurio</h3><p>Weka mahudhurio</p></div>
            <div class="menu-card border-blue"><h3>Mitihani Yangu</h3><p>Weka alama</p></div>
        `;
    }

    menuContainer.innerHTML = html;
}

// Kazi ya Kuleta Takwimu
async function loadDashboardData() {
    let url = '/api/dashboard/stats';
    
    // Kama ni Super Admin, ongeza school_id aliyoichagua kwenye dropdown
    if (user.role === 'super_admin') {
        const selectedSchool = document.getElementById('school-select').value;
        if (selectedSchool) {
            url += `?school_id=${selectedSchool}`;
        } else {
            // Kama hajachagua shule, usifanye request
            document.getElementById('stat-students').innerText = '0';
            document.getElementById('stat-teachers').innerText = '0';
            document.getElementById('stat-classes').innerText = '0';
            document.getElementById('stat-fees').innerText = 'Tsh 0';
            return; 
        }
    }

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();

        if (response.ok) {
            // Weka Takwimu
            document.getElementById('stat-students').innerText = data.totalStudents;
            document.getElementById('stat-teachers').innerText = data.totalTeachers;
            document.getElementById('stat-classes').innerText = data.totalClasses;
            document.getElementById('stat-fees').innerText = 'Tsh ' + data.totalFees.toLocaleString();

            // Mabadiliko Muhimu: Ficha Dropdown kwa Mkuu wa Shule
            if (user.role === 'school_manager') {
                document.getElementById('dropdown-container').style.display = 'none';
                document.getElementById('static-school-container').style.display = 'block';
                document.getElementById('static-school-name').innerText = data.schoolName;
            }
        }
    } catch (error) {
        console.error("Kosa la kupata data:", error);
    }
}

// Kazi ya Kuleta Shule kwa ajili ya Super Admin Dropdown
async function loadSchoolsForDropdown() {
    if (user.role !== 'super_admin') return;

    document.getElementById('dropdown-container').style.display = 'block';
    document.getElementById('static-school-container').style.display = 'none';

    try {
        const response = await fetch('/api/schools', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const schools = await response.json();
        
        const select = document.getElementById('school-select');
        schools.forEach(school => {
            const option = document.createElement('option');
            option.value = school.id;
            option.text = school.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Kosa la kuleta shule:", error);
    }
}

// Kazi ya Kutoka (Logout)
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}

// Anzisha mfumo mtumiaji akiingia
document.addEventListener('DOMContentLoaded', () => {
    renderMenu();
    if (user.role === 'super_admin') {
        loadSchoolsForDropdown();
    } else if (user.role === 'school_manager') {
        // Mkuu wa shule anaita data moja kwa moja
        loadDashboardData(); 
    }
});