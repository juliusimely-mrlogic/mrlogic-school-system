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

    // Vigeu vya kutunza Chart instances ili kuzifuta kabla ya kuchora mpya
    let feesChartInstance = null;
    let genderOverallChartInstance = null;
    let genderStreamChartInstance = null;
    let examResultsChartInstance = null;

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
        // 1. Futa charts za zamani kama zipo kuzuia mrundikano
        if (feesChartInstance) feesChartInstance.destroy();
        if (genderOverallChartInstance) genderOverallChartInstance.destroy();
        if (genderStreamChartInstance) genderStreamChartInstance.destroy();
        if (examResultsChartInstance) examResultsChartInstance.destroy();

        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false, 
            animation: { duration: 800 }, 
        };

        // 2. Chart ya Fedha (Bar)
        const ctxFees = document.getElementById('feesChart').getContext('2d');
        feesChartInstance = new Chart(ctxFees, {
            type: 'bar',
            data: {
                labels: ['Makadirio', 'Iliyokusanywa', 'Deni'],
                datasets: [{
                    data: [Number(data.totalExpectedFees), Number(data.totalCollectedFees), Number(data.totalOutstandingFees)],
                    backgroundColor: ['#f59e0b', '#10b981', '#ef4444'],
                    borderRadius: 4
                }]
            },
            options: {
                ...commonOptions,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });

        // 3. Chart ya Jinsia Overall (Doughnut)
        const maleOverall = Number(data.overallGender.M);
        const femaleOverall = Number(data.overallGender.F);

        const ctxGenderOverall = document.getElementById('genderOverallChart').getContext('2d');
        genderOverallChartInstance = new Chart(ctxGenderOverall, {
            type: 'doughnut',
            data: {
                labels: ['Me (M)', 'Ke (F)'],
                datasets: [{
                    data: [maleOverall, femaleOverall],
                    backgroundColor: ['#3b82f6', '#ec4899'],
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                ...commonOptions,
                cutout: '65%', // Inafanya shimo la katikati lionekane vizuri
                plugins: { 
                    legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15 } } 
                }
            }
        });

        // 4. Chart ya Ufaulu (Bar)
        const ctxExamResults = document.getElementById('examResultsChart').getContext('2d');
        examResultsChartInstance = new Chart(ctxExamResults, {
            type: 'bar',
            data: {
                labels: ['Div I', 'Div II', 'Div III', 'Div IV', 'Div 0', 'INC', 'ABS'],
                datasets: [{
                    data: [
                        Number(data.examStats.div1), Number(data.examStats.div2), Number(data.examStats.div3), 
                        Number(data.examStats.div4), Number(data.examStats.div0), Number(data.examStats.inc), Number(data.examStats.abs)
                    ],
                    backgroundColor: ['#10b981', '#14b8a6', '#3b82f6', '#6366f1', '#374151', '#f59e0b', '#6b7280'],
                    borderRadius: 4
                }]
            },
            options: {
                ...commonOptions,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
            }
        });

        // 5. Chart ya Jinsia kwa Kila Darasa (Stacked Bar Chart)
        const ctxGenderStream = document.getElementById('genderStreamChart').getContext('2d');
        
        const streamLabels = data.streamGenderStats.map(s => s.stream_name);
        const maleData = data.streamGenderStats.map(s => Number(s.male));
        const femaleData = data.streamGenderStats.map(s => Number(s.female));

        genderStreamChartInstance = new Chart(ctxGenderStream, {
            type: 'bar',
            data: {
                labels: streamLabels,
                datasets: [
                    { label: 'Me (M)', data: maleData, backgroundColor: '#3b82f6', borderRadius: 2 },
                    { label: 'Ke (F)', data: femaleData, backgroundColor: '#ec4899', borderRadius: 2 }
                ]
            },
            options: {
                ...commonOptions,
                plugins: { 
                    legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15 } } 
                },
                scales: {
                    x: { stacked: true, grid: { display: false } },
                    y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
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
                    // Weka sifuri na futa charts kama hakuna shule iliyochaguliwa
                    ['students','teachers','classes','expected-fees','collected-fees','outstanding-fees','div1','div2','div3','div4','div0','inc','pass','abs'].forEach(id => {
                        document.getElementById(`stat-${id}`).innerText = id.includes('fees') ? 'Tsh 0' : '0';
                    });
                    if (feesChartInstance) feesChartInstance.destroy();
                    if (genderOverallChartInstance) genderOverallChartInstance.destroy();
                    if (genderStreamChartInstance) genderStreamChartInstance.destroy();
                    if (examResultsChartInstance) examResultsChartInstance.destroy();
                    return; 
                }
            }
        }

        try {
            const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (response.status === 401) { localStorage.clear(); window.location.replace('/login.html'); return; }
            if (!response.ok) return;
            
            const data = await response.json();
            
            // Sasisha Kadi za Idadi
            document.getElementById('stat-students').innerText = data.totalStudents;
            document.getElementById('stat-teachers').innerText = data.totalTeachers;
            document.getElementById('stat-classes').innerText = data.totalClasses;

            // Sasisha Kadi za Fedha
            document.getElementById('stat-expected-fees').innerText = 'Tsh ' + Number(data.totalExpectedFees).toLocaleString();
            document.getElementById('stat-collected-fees').innerText = 'Tsh ' + Number(data.totalCollectedFees).toLocaleString();
            document.getElementById('stat-outstanding-fees').innerText = 'Tsh ' + Number(data.totalOutstandingFees).toLocaleString();

            // Sasisha Kadi za Matokeo
            document.getElementById('stat-div1').innerText = data.examStats.div1;
            document.getElementById('stat-div2').innerText = data.examStats.div2;
            document.getElementById('stat-div3').innerText = data.examStats.div3;
            document.getElementById('stat-div4').innerText = data.examStats.div4;
            document.getElementById('stat-div0').innerText = data.examStats.div0;
            document.getElementById('stat-inc').innerText = data.examStats.inc;
            document.getElementById('stat-pass').innerText = data.examStats.pass;
            document.getElementById('stat-abs').innerText = data.examStats.abs;

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
            loadDashboardData(); 
        } 
        else if (user.role === 'school_manager' || user.role === 'mtaaluma_mkuu') { 
            loadDashboardData(); 
        }
    });
}