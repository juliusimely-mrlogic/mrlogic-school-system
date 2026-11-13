const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');

if (!token || !userStr) {
    window.location.replace('/login.html');
}

function logout() {
    localStorage.clear();
    window.location.replace('/login.html');
}

async function loadStreams() {
    const tableBody = document.getElementById('streams-table-body');
    
    try {
        const response = await fetch('/api/streams', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            localStorage.clear();
            window.location.replace('/login.html');
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const streams = await response.json();

        if (streams.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center;">Hakuna madarasa yaliyosajiliwa kwenye shule hii.</td></tr>`;
            return;
        }

        let html = '';
        streams.forEach((stream, index) => {
            // Tunatafuta jina la darasa kwa uangalifu (inaweza kuwa 'name' au 'class_name')
            const jinaLaDarasa = stream.name || stream.class_name || stream.jina || 'Hajajaza';
            const ngazi = stream.level || stream.ngazi || 'Hajajaza';

            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${jinaLaDarasa}</td>
                    <td>${ngazi}</td>
                </tr>
            `;
        });

        tableBody.innerHTML = html;

    } catch (error) {
        console.error("Kosa la mtandao:", error);
        tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: red;">Kuna tatizo limetokea wakati wa kuleta madarasa.</td></tr>`;
    }
}

document.addEventListener('DOMContentLoaded', loadStreams);