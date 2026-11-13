const userStr = localStorage.getItem('user');
const token = localStorage.getItem('token');

if (!token || !userStr) {
    window.location.replace('/login.html');
} else {
    let user;
    try { 
        user = JSON.parse(userStr); 
    } catch (e) { 
        localStorage.clear(); 
        window.location.replace('/login.html'); 
    }

    // Weka jina la mtumiaji juu
    if (document.getElementById('user-name')) {
        document.getElementById('user-name').innerText = user.full_name || user.name || "Mtumiaji";
    }

    // Kazi ya kuonyesha kadi kulingana na cheo cha mtumiaji
    function renderMenu() {
        const menuContainer = document.getElementById('menu-container');
        if(!menuContainer) return;
        let html = '';

        // 1. KADI ZA WOTE (Super Admin, Mkuu wa Shule, Mtaaluma Mkuu)
        if (user.role === 'super_admin' || user.role === 'school_manager' || user.role === 'mtaaluma_mkuu') {
            html += `
                <div class="menu-card border-blue" onclick="window.location.href='/students.html'">
                    <h3>Wanafunzi</h3><p>Simamia wanafunzi</p>
                </div>
                <div class="menu-card border-red" onclick="window.location.href='/teachers.html'">
                    <h3>Walimu</h3><p>Walimu na Majukumu</p>
                </div>
                <div class="menu-card border-purple" onclick="window.location.href='/academics.html'">
                    <h3>Mipangilio ya Masomo</h3><p>Madarasa, Masomo & Mitihani</p>
                </div>
                <div class="menu-card border-red" onclick="window.location.href='/assignments.html'">
                    <h3>Kupanga Walimu</h3><p>Gawa Masomo kwa Walimu</p>
                </div>
                <div class="menu-card border-orange" onclick="window.location.href='/attendance.html'">
                    <h3>Mahudhurio</h3><p>Weka mahudhurio</p>
                </div>
                <div class="menu-card border-blue" onclick="window.location.href='/exams.html'">
                    <h3>Kuingiza Alama</h3><p>Weka alama za mitihani</p>
                </div>
                <div class="menu-card border-blue" onclick="window.location.href='/reports.html'">
                    <h3>Broadsheet</h3><p>Matokeo ya darasa zima</p>
                </div>
                <div class="menu-card border-green" onclick="window.location.href='/student-report.html'">
                    <h3>Ripoti Binafsi</h3><p>Toa Report Card ya mwanafunzi</p>
                </div>
                <div class="menu-card border-blue">
                    <h3>Taarifa</h3><p>Tuma na angalia taarifa</p>
                </div>
            `;
        }

        // 2. KADI YA ADA (Super Admin na Mkuu wa Shule Pekee)
        if (user.role === 'super_admin' || user.role === 'school_manager') {
            html += `
                <div class="menu-card border-green" onclick="window.location.href='/fees.html'">
                    <h3>Usimamizi wa Ada</h3><p>Angalia malipo na madeni</p>
                </div>
            `;
        }

        // 3. KADI ZA SUPER ADMIN PEKEE (Watumiaji na Shule)
        if (user.role === 'super_admin') {
            html += `
                <div class="menu-card border-purple" onclick="window.location.href='/users.html'">
                    <h3>Watumiaji</h3><p>Sajili Wakuu wa Shule na Walimu</p>
                </div>
                <div class="menu-card border-blue" onclick="window.location.href='/schools.html'">
                    <h3>Shule</h3><p>Sajili na Simamia Shule</p>
                </div>
            `;
        }

        // 4. KADI ZA MWALIMU PEKEE
        if (user.role === 'teacher') {
            html += `
                <div class="menu-card border-blue" onclick="window.location.href='/students.html'">
                    <h3>Wanafunzi Wangu</h3><p>Darasa lako</p>
                </div>
                <div class="menu-card border-orange" onclick="window.location.href='/attendance.html'">
                    <h3>Mahudhurio</h3><p>Weka mahudhurio</p>
                </div>
                <div class="menu-card border-blue" onclick="window.location.href='/exams.html'">
                    <h3>Kuingiza Alama</h3><p>Weka alama</p>
                </div>
                <div class="menu-card border-blue" onclick="window.location.href='/reports.html'">
                    <h3>Broadsheet</h3><p>Matokeo</p>
                </div>
                <div class="menu-card border-green" onclick="window.location.href='/student-report.html'">
                    <h3>Ripoti Binafsi</h3><p>Toa Report Card</p>
                </div>
            `;
        }

        menuContainer.innerHTML = html;
    }

    // Kazi ya kutoka (Logout)
    window.logout = function() { 
        localStorage.clear(); 
        window.location.replace('/login.html'); 
    }

    // Kazi ya kuleta Takwimu (Stats)
    async function loadDashboardData() {
        let url = '/api/dashboard/stats';
        
        // Kama ni Super Admin, angalia kama amechagua shule kwenye dropdown
        if (user.role === 'super_admin') {
            const selectElement = document.getElementById('school-select');
            if (selectElement) {
                const selectedSchool = selectElement.value;
                if (selectedSchool) { 
                    url += `?school_id=${selectedSchool}`; 
                } else {
                    // Kama hajachagua shule, weka sifuri
                    document.getElementById('stat-students').innerText = '0';
                    document.getElementById('stat-teachers').innerText = '0';
                    document.getElementById('stat-classes').innerText = '0';
                    document.getElementById('stat-fees').innerText = 'Tsh 0';
                    document.getElementById('static-school-container').style.display = 'none';
                    return; 
                }
            }
        }

        try {
            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            
            if (response.status === 401) { 
                localStorage.clear(); 
                window.location.replace('/login.html'); 
                return; 
            }
            if (!response.ok) return;
            
            const data = await response.json();
            
            document.getElementById('stat-students').innerText = data.totalStudents;
            document.getElementById('stat-teachers').innerText = data.totalTeachers;
            document.getElementById('stat-classes').innerText = data.totalClasses;
            document.getElementById('stat-fees').innerText = 'Tsh ' + data.totalFees.toLocaleString();

            // Mkuu wa shule na Mtaaluma wanaona jina la shule moja kwa moja
            if (user.role === 'school_manager' || user.role === 'mtaaluma_mkuu') {
                document.getElementById('dropdown-container').style.display = 'none';
                document.getElementById('static-school-container').style.display = 'block';
                document.getElementById('static-school-name').innerText = data.schoolName;
            }
        } catch (error) { 
            console.error("Kosa la kuleta takwimu:", error); 
        }
    }

    // Kazi ya kuleta orodha ya shule kwenye Dropdown (Super Admin)
    async function loadSchoolsForDropdown() {
        if (user.role !== 'super_admin') return;
        
        document.getElementById('dropdown-container').style.display = 'block';
        document.getElementById('static-school-container').style.display = 'none';
        
        try {
            const response = await fetch('/api/schools', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) return;
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

    // Anzisha mfumo mtumiaji akiingia
    document.addEventListener('DOMContentLoaded', () => {
        renderMenu();
        if (user.role === 'super_admin') { 
            loadSchoolsForDropdown(); 
            loadDashboardData(); // Itaonyesha sifuri mwanzoni hadi achague shule
        } 
        else if (user.role === 'school_manager' || user.role === 'mtaaluma_mkuu') { 
            loadDashboardData(); 
        }
    });
}