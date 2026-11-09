// 11. USIMAMIZI WA ADA (FEES MANAGEMENT)
document.getElementById('fee-structure-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentSchoolId) return alert("Chagua shule kwanza!");

    const body = {
        school_id: currentSchoolId,
        class_id: document.getElementById('struct-class').value,
        term: document.getElementById('struct-term').value,
        year: parseInt(document.getElementById('struct-year').value),
        amount: parseFloat(document.getElementById('struct-amount').value)
    };

    try {
        const res = await fetch(`${API_BASE}/fees/structure`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(body)
        });
        if (res.ok) {
            alert("Ada imewekwa kikamilifu!");
            document.getElementById('fee-structure-form').reset();
        } else {
            const err = await res.json(); alert("Kosa: " + err.error);
        }
    } catch (err) { alert("Hitilafu ya mtandao"); }
});

async function loadFeeStatus() {
    if (!currentSchoolId) return alert("Chagua shule kwanza!");
    const term = document.getElementById('status-term').value;
    const year = parseInt(document.getElementById('status-year').value);

    try {
        const res = await fetch(`${API_BASE}/fees/status/${currentSchoolId}?term=${term}&year=${year}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        
        const tbody = document.getElementById('fee-status-body');
        tbody.innerHTML = '';

        if (data.statusList && data.statusList.length > 0) {
            data.statusList.forEach(s => {
                // Rangi kulingana na hali
                let rowColor = 'transparent';
                if (s.status === 'AMELIPA ZOTE') rowColor = '#d4edda'; // Green
                if (s.status === 'AMELIPA KIDOGO') rowColor = '#fff3cd'; // Yellow
                if (s.status === 'HAJALIPA') rowColor = '#f8d7da'; // Red

                tbody.innerHTML += `
                    <tr style="background-color: ${rowColor};">
                        <td><strong>${s.full_name}</strong></td>
                        <td>${s.class_name}</td>
                        <td>Tsh ${s.requiredAmount.toLocaleString()}</td>
                        <td>Tsh ${s.paidAmount.toLocaleString()}</td>
                        <td>Tsh ${s.balance.toLocaleString()}</td>
                        <td><strong>${s.status}</strong></td>
                    </tr>
                `;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Hakuna wanafunzi kwenye shule hii.</td></tr>';
        }
    } catch (err) { alert("Kosa la kuvuta hali ya ada."); }
}

// Kusasisha showSection ili kuingiza na sehemu ya ada
function showSection(id) {
    ['students', 'classes', 'exams', 'fees'].forEach(s => {
        const el = document.getElementById(`${s}-section`);
        if(el) el.style.display = 'none';
    });
    const target = document.getElementById(`${id}-section`);
    if(target) target.style.display = 'block';
    if(!currentSchoolId) alert("Chagua shule kwanza!");
}