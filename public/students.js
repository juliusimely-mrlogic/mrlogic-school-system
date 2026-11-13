const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');

if (!token || !userStr) {
    window.location.replace('/login.html');
}

function logout() {
    localStorage.clear();
    window.location.replace('/login.html');
}

async function loadStudents() {
    const tableBody = document.getElementById('students-table-body');
    
    try {
        const response = await fetch('/api/students', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

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
                    <td>${student.admission_number || 'Hajapewa'}</td>
                    <td>${student.full_name}</td>
                    <td>${student.gender || 'Hajajaza'}</td>
                    <td>${student.stream_id || 'Hajapewa'}</td>
                </tr>
            `;
        });

        tableBody.innerHTML = html;

    } catch (error) {
        console.error("Kosa la mtandao:", error);
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Token imeisha muda. Tafadhali toka na uingie upya.</td></tr>`;
    }
}

document.addEventListener('DOMContentLoaded', loadStudents);