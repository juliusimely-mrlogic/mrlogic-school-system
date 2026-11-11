const userStr = localStorage.getItem('user');
const token = localStorage.getItem('token');

// KAMA HAKUNA TOKEN, RUDI KWENYE LOGIN (Hapa ndio mzizi wa loop)
if (!token || !userStr) {
    window.location.replace('/login.html');
} else {
    // Kama token ipo, endelea na mfumo
    let user;
    try {
        user = JSON.parse(userStr);
    } catch (e) {
        localStorage.clear();
        window.location.replace('/login.html');
    }

    if (document.getElementById('user-name')) {
        document.getElementById('user-name').innerText = user.full_name || user.name || "Mtumiaji";
    }

    function renderMenu() {
        const menuContainer = document.getElementById('menu-container');
        if(!menuContainer) return;
        let html = '';

        if (user.role === 'super_admin' || user.role === 'school_manager' || user.role === 'mtaaluma_mkuu') {
            html += `
                <div class="menu-card border-blue"><h3>Wanafunzi</h3><p>Simamia wanafunzi</p></div>
                <div class="menu-card border-red"><h3>Walimu</h3><p>Walimu na Majukumu</p></div>
                <div class="menu-card border-purple"><h3>Madarasa</h3><p>Angalia madarasa</p></div>
                <div class="menu-card border-orange"><h3>Mahudhurio</h3><p>Weka mahudhurio</p></div>
                <div class="menu-card border-blue"><h3>Mitihani & Ripoti</h3><p>Ingiza, chakata, na chapisha</p></div>
                <div class="menu-card border-blue"><h3>Taarifa</h3><p>Tuma na angalia taarifa</p></div>
            `;
        }

        if (user.role === 'super_admin' || user.role === 'school_manager') {
            html += `<div class="menu-card border-green"><h3>Usimamizi wa Ada</h3><p>Angalia malipo na madeni</p></div>`;
        }

        if (user.role === 'super_admin') {
            html += `<div class="menu-card border-purple"><h3>Watumiaji</h3><p>Sajili Wakuu wa Shule na Walimu</p></div>`;
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

    function logout() {
        localStorage.clear();
        window.location.replace('/login.html');
    }

    async function loadDashboardData() {
        let url = '/api/dashboard/stats';
        
        if (user.role === 'super_admin') {
            const selectElement = document.getElementById('school-select');
            if (selectElement) {
                const selectedSchool = selectElement.value;
                if (selectedSchool) {
                    url += `?school_id=${selectedSchool}`;
                } else {
                    document.getElementById('stat-students').innerText = '0';
                    document.getElementById('stat-teachers').innerText = '0';
                    document.getElementById('stat-classes').innerText = '0';
                    document.getElementById('stat-fees').innerText = 'Tsh 0';
                    return; 
                }
            }
        }

        try {
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) return;

            const data = await response.json();

            document.getElementById('stat-students').innerText = data.totalStudents;
            document.getElementById('stat-teachers').innerText = data.totalTeachers;
            document.getElementById('stat-classes').innerText = data.totalClasses;
            document.getElementById('stat-fees').innerText = 'Tsh ' + data.totalFees.toLocaleString();

            if (user.role === 'school_manager' || user.role === 'mtaaluma_mkuu') {
                document.getElementById('dropdown-container').style.display = 'none';
                document.getElementById('static-school-container').style.display = 'block';
                document.getElementById('static-school-name').innerText = data.schoolName;
            }
        } catch (error) {
            console.error("Kosa la mtandao:", error);
        }
    }

    async function loadSchoolsForDropdown() {
        if (user.role !== 'super_admin') return;

        document.getElementById('dropdown-container').style.display = 'block';
        document.getElementById('static-school-container').style.display = 'none';

        try {
            const response = await fetch('/api/schools', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
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

    document.addEventListener('DOMContentLoaded', () => {
        renderMenu();
        if (user.role === 'super_admin') {
            loadSchoolsForDropdown();
        } else if (user.role === 'school_manager' || user.role === 'mtaaluma_mkuu') {
            loadDashboardData(); 
        }
    });
}