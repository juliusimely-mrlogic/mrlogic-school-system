const userStr = localStorage.getItem('user');
const token = localStorage.getItem('token');

if (!token || !userStr) {
    window.location.replace('/login.html');
} else {
    let user;
    try { user = JSON.parse(userStr); } catch (e) { localStorage.clear(); window.location.replace('/login.html'); }

    if (document.getElementById('user-name')) {
        document.getElementById('user-name').innerText = user.full_name || user.name || "Mtumiaji";
    }

    // Vigeu vya kutunza Chart instances
    let peopleChartInstance = null;
    let feesChartInstance = null;

    function renderMenu() {
        const menuContainer = document.getElementById('menu-container');
        if(!menuContainer) return;
        let html = '';

        if (user.role === 'super_admin' || user.role === 'school_manager' || user.role === 'mtaaluma_mkuu') {
            html += `
                <div class="menu-card border-blue" onclick="window.location.href='/students.html'"><h3>Wanafunzi</h3><p>Simamia wanafunzi</p></div>
                <div class="menu-card border-red" onclick="window.location.href='/teachers.html'"><h3>Walimu</h3><p>Walimu na Majukumu</p></div>
                <div class="menu-card border-purple" onclick="window.location.href='/academics.html'"><h3>Mipangilio ya Masomo</h3><p>Madarasa, Masomo & Mitihani</p></div>
                <div class="menu-card border-red" onclick="window.location.href='/assignments.html'"><h3>Kupanga Walimu</h3><p>Gawa Masomo kwa Walimu</p></div>
                <div class="menu-card border-orange" onclick="window.location.href='/attendance.html'"><h3>Mahudhurio</h3><p>Weka mahudhurio</p></div>
                <div class="menu-card border-blue" onclick="window.location.href='/exams.html'"><h3>Kuingiza Alama</h3><p>Weka alama za mitihani</p></div>
                <div class="menu-card border-blue" onclick="window.location.href='/reports.html'"><h3>Broadsheet</h3><p>Matokeo ya darasa zima</p></div>
                <div class="menu-card border-green" onclick="window.location.href='/student-report.html'"><h3>Ripoti Binafsi</h3><p>Toa Report Card ya mwanafunzi</p></div>
                <div class="menu-card border-blue" onclick="window.location.href='/notifications.html'"><h3>Taarifa</h3><p>Tuma na angalia taarifa</p></div>
            `;
        }
        if (user.role === 'super_admin' || user.role === 'school_manager') {
            html += `<div class="menu-card border-green" onclick="window.location.href='/fees.html'"><h3>Usimamizi wa Ada</h3><p>Angalia malipo na madeni</p></div>`;
        }
        if (user.role === 'super_admin') {
            html += `<div class="menu-card border-purple" onclick="window.location.href='/users.html'"><h3>Watumiaji</h3><p>Sajili Wakuu wa Shule na Walimu</p></div>`;
            html += `<div class="menu-card border-blue" onclick="window.location.href='/schools.html'"><h3>Shule</h3><p>Sajili na Simamia Shule</p></div>`;
        }
        if (user.role === 'teacher') {
            html += `
                <div class="menu-card border-blue" onclick="window.location.href='/students.html'"><h3>Wanafunzi Wangu</h3><p>Darasa lako</p></div>
                <div class="menu-card border-orange" onclick="window.location.href='/attendance.html'"><h3>Mahudhurio</h3><p>Weka mahudhurio</p></div>
                <div class="menu-card border-blue" onclick="window.location.href='/exams.html'"><h3>Kuingiza Alama</h3><p>Weka alama</p></div>
                <div class="menu-card border-blue" onclick="window.location.href='/reports.html'"><h3>Broadsheet</h3><p>Matokeo</p></div>
                <div class="menu-card border-green" onclick="window.location.href='/student-report.html'"><h3>Ripoti Binafsi</h3><p>Toa Report Card</p></div>
                <div class="menu-card border-blue" onclick="window.location.href='/notifications.html'"><h3>Taarifa</h3><p>Angalia taarifa</p></div>
            `;
        }
        menuContainer.innerHTML = html;
    }

    window.logout = function() { localStorage.clear(); window.location.replace('/login.html'); }

    // ==========================================
    // KAZI YA KUCHORA MICHORO (CHARTS)
    // ==========================================
    function renderCharts(data) {
        // 1. Futa charts za zamani kama zipo (ili kuzuia kujirudia)
        if (peopleChartInstance) peopleChartInstance.destroy();
        if (feesChartInstance) feesChartInstance.destroy();

        // 2. Chart ya Idadi ya Watu (Bar Chart)
        const ctxPeople = document.getElementById('peopleChart').getContext('2d');
        peopleChartInstance = new Chart(ctxPeople, {
            type: 'bar',
            data: {
                labels: ['Wanafunzi', 'Walimu', 'Madarasa'],
                datasets: [{
                    label: 'Idadi',
                    data: [data.totalStudents, data.totalTeachers, data.totalClasses],
                    backgroundColor: ['#3b82f6', '#ef4444', '#a855f7'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
            }
        });

        // 3. Chart ya Ada (Doughnut Chart)
        // Kwa kuwa hatuna kiasi cha "Target", tutatumia kiasi kilicholipwa kama kielelezo
        // Kama kiasi ni 0, tunaweka 1 ili chart ionekane (isiyo na data)
        const ctxFees = document.getElementById('feesChart').getContext('2d');
        const feesValue = data.totalFees > 0 ? data.totalFees : 1; 
        
        feesChartInstance = new Chart(ctxFees, {
            type: 'doughnut',
            data: {
                labels: ['Ada Iliyokusanywa (Tsh)'],
                datasets: [{
                    data: [feesValue],
                    backgroundColor: ['#10b981'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) { label += ': '; }
                                if (context.parsed !== null) {
                                    label += new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS' }).format(data.totalFees);
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }

    // Kazi ya Kuleta Takwimu
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
                    // Futa charts kama hakuna shule iliyochaguliwa
                    if (peopleChartInstance) peopleChartInstance.destroy();
                    if (feesChartInstance) feesChartInstance.destroy();
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
            
            // Sasisha Kadi za Takwimu
            document.getElementById('stat-students').innerText = data.totalStudents;
            document.getElementById('stat-teachers').innerText = data.totalTeachers;
            document.getElementById('stat-classes').innerText = data.totalClasses;
            document.getElementById('stat-fees').innerText = 'Tsh ' + data.totalFees.toLocaleString();

            // Chora Michoro
            renderCharts(data);

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
            loadDashboardData(); // Itajaribu kuleta data (itakuwa 0 kama hajachagua shule)
        } 
        else if (user.role === 'school_manager' || user.role === 'mtaaluma_mkuu') { 
            loadDashboardData(); 
        }
    });
}