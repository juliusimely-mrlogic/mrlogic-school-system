const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');

if (!token || !userStr) {
    window.location.replace('/login.html');
}

const user = JSON.parse(userStr);

function logout() {
    localStorage.clear();
    window.location.replace('/login.html');
}

async function loadStudents() {
    const tableBody = document.getElementById('students-table-body');
    
    try {
        // Kama ni Super Admin, anahitaji kupeleka school_id kwenye URL (Unaweza kuongeza hii baadaye)
        // Kwa sasa tunategemea backend ichukue school_id kutoka kwenye token ya mtumiaji.
        const response = await fetch('/api/students', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Imeshindwa kuleta data");

        const students = await response.json();

        if (students.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Hakuna wanafunzi waliyosajiliwa kwenye shule hii.</td></tr>`;
            return;
        }

        let html = '';
        students.forEach((student, index) => {
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${student.full_name}</td>
                    <td>${student.gender || 'Hajajaza'}</td>
                    <td>${student.stream_id || 'Hajapewa'}</td>
                    <td>
                        <button style="padding: 5px 10px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">Angalia</button>
                    </td>
                </tr>
            `;
        });

        tableBody.innerHTML = html;

    } catch (error) {
        console.error("Kosa:", error);
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Kuna tatizo limetokea wakati wa kuleta wanafunzi.</td></tr>`;
    }
}

// Anzisha ukurasa
document.addEventListener('DOMContentLoaded', loadStudents);