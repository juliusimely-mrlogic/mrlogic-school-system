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

document.addEventListener('DOMContentLoaded', () => {
    // Kama ni Super Admin au Mkuu wa Shule, mpe fomu ya kutuma
    if (user.role === 'super_admin' || user.role === 'school_manager') {
        document.getElementById('send-form-container').style.display = 'block';
    }
    loadNotifications();
});

// 1. Pakia Taarifa
async function loadNotifications() {
    const listContainer = document.getElementById('notifications-list');
    try {
        const response = await fetch('/api/notifications', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Imeshindwa");
        
        const notifications = await response.json();

        if (notifications.length === 0) {
            listContainer.innerHTML = `<p style="text-align:center; color:#666;">Hakuna taarifa zilizotumwa bado.</p>`;
            return;
        }

        let html = '';
        notifications.forEach(notif => {
            const dateObj = new Date(notif.created_at);
            const formattedDate = isNaN(dateObj) ? notif.created_at : dateObj.toLocaleString('sw-TZ');
            
            // Kama ni Admin, mpe kitufe cha kufuta
            const deleteBtn = (user.role === 'super_admin' || user.role === 'school_manager') 
                ? `<button class="btn-delete" onclick="deleteNotification(${notif.id})">Futa</button>` 
                : '';

            html += `
                <div class="notification-card">
                    ${deleteBtn}
                    <div class="notification-title">${notif.title}</div>
                    <div class="notification-meta">Imetumwa na: <strong>${notif.sender_name}</strong> | Tarehe: ${formattedDate}</div>
                    <div class="notification-msg">${notif.message}</div>
                </div>
            `;
        });
        listContainer.innerHTML = html;

    } catch (error) {
        listContainer.innerHTML = `<p style="text-align:center; color:red;">Kosa la mtandao.</p>`;
    }
}

// 2. Tuma Taarifa Mpya
document.getElementById('notificationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusMsg = document.getElementById('status-msg');
    
    const title = document.getElementById('title').value;
    const message = document.getElementById('message').value;

    statusMsg.innerText = "Inatuma..."; statusMsg.style.color = "blue";

    try {
        const response = await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ title, message, target_role: 'all' })
        });

        const data = await response.json();

        if (response.ok) {
            statusMsg.innerText = "✅ Taarifa imetumwa!";
            statusMsg.style.color = "green";
            document.getElementById('notificationForm').reset();
            loadNotifications(); // Refresh list
            setTimeout(() => { statusMsg.innerText = ""; }, 3000);
        } else {
            // Onyesha kosa halisi kutoka Backend
            statusMsg.innerText = `❌ Kosa: ${data.error || 'Imeshindikana'}`;
            statusMsg.style.color = "red";
        }
    } catch (error) {
        statusMsg.innerText = "❌ Kosa la mtandao";
        statusMsg.style.color = "red";
    }
});

// 3. Futa Taarifa
async function deleteNotification(id) {
    if (!confirm("Je, una uhakika unataka kufuta taarifa hii?")) return;

    try {
        const response = await fetch(`/api/notifications/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            loadNotifications();
        } else {
            alert("Imeshindikana kufuta.");
        }
    } catch (error) {
        console.error(error);
    }
}