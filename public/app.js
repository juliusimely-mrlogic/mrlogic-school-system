// 1. Simulizi ya mtumiaji aliyelogin (Kwenye mfumo halisi hii inatoka kwenye Login API yako)
// Badilisha hizi taarifa hapa chini kujaribu (Mfano: weka role: 'super_admin' au 'school_manager')
const currentUser = {
    name: "WINSTON A MULUNGU",
    role: "school_manager", // JARIBU KUBADILISHA HAPA: 'school_manager' au 'super_admin'
    school_id: 101,
    school_name: "NYANG'HOMANGO SECONDARY SCHOOL",
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." // Weka token yako halisi
};

// 2. KAZI YA KUPANGA UI KULINGANA NA CHEO
function setupDashboardUI() {
    document.getElementById('user-info').innerText = `Karibu, ${currentUser.name}`;
    
    const selectorContainer = document.getElementById('school-selector-container');

    if (currentUser.role === 'super_admin') {
        // Kama ni Super Admin, weka dropdown
        selectorContainer.innerHTML = `
            <label><strong>Chagua Shule:</strong></label>
            <select id="school-dropdown" style="padding: 8px; margin-left: 10px; border-radius: 4px; border: 1px solid #ccc;">
                <option value="">-- Chagua Shule --</option>
                <option value="101">NYANG'HOMANGO SECONDARY SCHOOL</option>
                <option value="102">SHULE NYINGINE SECONDARY SCHOOL</option>
            </select>
        `;

        // Weka event listener, kila akibadilisha dropdown, data ziletwe upya
        document.getElementById('school-dropdown').addEventListener('change', (e) => {
            const selectedId = e.target.value;
            if(selectedId) loadStats(selectedId);
        });

        // Kama Super admin hajachagua, onyesha sifuri
        loadStats(null); 

    } else {
        // Kama ni Mkuu wa Shule (School Manager), onyesha maandishi tu, HAKUNA DROPDOWN
        selectorContainer.innerHTML = `
            <label><strong>Shule:</strong></label>
            <span style="margin-left: 10px; font-weight: bold; color: #1e3a8a;">${currentUser.school_name}</span>
        `;

        // Pakia takwimu za shule yake mwenyewe
        loadStats(currentUser.school_id); 
    }
}

// 3. KAZI YA KULETA TAKWIMU KUTOKA API
async function loadStats(schoolId = null) {
    try {
        // Kama Super admin hajachagua shule, usifanye request
        if (currentUser.role === 'super_admin' && !schoolId) {
            document.getElementById('stat-students').innerText = "0";
            document.getElementById('stat-teachers').innerText = "0";
            document.getElementById('stat-classes').innerText = "0";
            document.getElementById('stat-fees').innerText = "Tsh 0";
            return;
        }

        // Tengeneza URL. Kama kuna schoolId, iweke kwenye query
        const url = schoolId 
            ? `/api/dashboard/stats?school_id=${schoolId}` 
            : `/api/dashboard/stats`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${currentUser.token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById('stat-students').innerText = data.totalStudents;
            document.getElementById('stat-teachers').innerText = data.totalTeachers;
            document.getElementById('stat-classes').innerText = data.totalClasses;
            document.getElementById('stat-fees').innerText = `Tsh ${data.totalFees.toLocaleString()}`;
            
            // Badilisha kichwa cha habari kama ni Super Admin
            if (currentUser.role === 'super_admin' && schoolId) {
                document.getElementById('stats-title').innerText = "Takwimu za Shule Iliyochaguliwa";
            } else {
                document.getElementById('stats-title').innerText = "Takwimu za Shule Yako";
            }
        } else {
            console.error("Kosa kutoka API:", data.error);
        }
    } catch (error) {
        console.error("Imeshindikana kuleta takwimu:", error);
    }
}

// 4. ANZISHA MFUMO MTUMIAJI AKIINGIA
document.addEventListener('DOMContentLoaded', () => {
    setupDashboardUI();
});