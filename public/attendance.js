const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');

if (!token || !userStr) {
    window.location.replace('/login.html');
}

function logout() {
    localStorage.clear();
    window.location.replace('/login.html');
}

let studentsData = []; // Tutahifadhi wanafunzi hapa

// 1. Weka Tarehe ya Leo kama default
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('attendance-date').value = today;
    loadStudentsForAttendance();
});

// 2. Leta Wanafunzi
async function loadStudentsForAttendance() {
    const tableBody = document.getElementById('attendance-table-body');
    
    try {
        const response = await fetch('/api/students', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            localStorage.clear();
            window.location.replace('/login.html');
            return;
        }

        studentsData = await response.json();

        if (studentsData.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center;">Hakuna wanafunzi kwenye shule hii.</td></tr>`;
            return;
        }

        let html = '';
        studentsData.forEach((student, index) => {
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${student.full_name}</td>
                    <td>
                        <div class="radio-group">
                            <label class="present">
                                <input type="radio" name="status_${student.id}" value="Present" checked> Aliyepo (Present)
                            </label>
                            <label class="absent">
                                <input type="radio" name="status_${student.id}" value="Absent"> Hayupo (Absent)
                            </label>
                        </div>
                    </td>
                </tr>
            `;
        });

        tableBody.innerHTML = html;

    } catch (error) {
        console.error("Kosa la mtandao:", error);
        tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: red;">Kuna tatizo limetokea wakati wa kuleta wanafunzi.</td></tr>`;
    }
}

// 3. Hifadhi Mahudhurio
async function saveAttendance() {
    const date = document.getElementById('attendance-date').value;
    const statusMsg = document.getElementById('save-status');

    if (!date) {
        alert("Tafadhali chagua tarehe kwanza!");
        return;
    }

    statusMsg.innerText = "Inahifadhi...";
    statusMsg.style.color = "blue";

    const records = [];
    studentsData.forEach(student => {
        const selectedRadio = document.querySelector(`input[name="status_${student.id}"]:checked`);
        if (selectedRadio) {
            records.push({
                student_id: student.id,
                status: selectedRadio.value
            });
        }
    });

    try {
        const response = await fetch('/api/attendance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ records, date })
        });

        const data = await response.json();

        if (response.ok) {
            statusMsg.innerText = "✅ Yamehifadhiwa!";
            statusMsg.style.color = "green";
            setTimeout(() => { statusMsg.innerText = ""; }, 3000);
        } else {
            statusMsg.innerText = "❌ Imeshindikana";
            statusMsg.style.color = "red";
            alert(data.error);
        }
    } catch (error) {
        console.error("Kosa:", error);
        statusMsg.innerText = "❌ Kosa la mtandao";
        statusMsg.style.color = "red";
    }
}