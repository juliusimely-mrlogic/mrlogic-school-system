const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');

if (!token || !userStr) {
    window.location.replace('/login.html');
}

function logout() {
    localStorage.clear();
    window.location.replace('/login.html');
}

document.addEventListener('DOMContentLoaded', () => {
    loadData();
});

// 1. Pakia Data Zote
async function loadData() {
    loadStreams();
    loadSubjects();
    loadExams();
}

async function loadStreams() {
    const list = document.getElementById('stream-list');
    try {
        const res = await fetch('/api/streams', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        list.innerHTML = data.map(s => `<li><span>${s.name}</span> <small>ID: ${s.id}</small></li>`).join('');
    } catch (err) { console.error(err); }
}

async function loadSubjects() {
    const list = document.getElementById('subject-list');
    try {
        const res = await fetch('/api/subjects', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        list.innerHTML = data.map(s => `<li><span>${s.name}</span> <small>ID: ${s.id}</small></li>`).join('');
    } catch (err) { console.error(err); }
}

async function loadExams() {
    const list = document.getElementById('exam-list');
    try {
        const res = await fetch('/api/exams', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        list.innerHTML = data.map(s => `<li><span>${s.name}</span> <small>ID: ${s.id}</small></li>`).join('');
    } catch (err) { console.error(err); }
}

// 2. Wasilisha Fomu za Kuongeza
document.getElementById('streamForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('stream_name').value;
    const msg = document.getElementById('stream-msg');
    msg.innerText = "Inaongeza..."; msg.style.color = "blue";

    try {
        const res = await fetch('/api/streams', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name })
        });
        if (res.ok) {
            msg.innerText = "✅ Imeongezwa!"; msg.style.color = "green";
            document.getElementById('streamForm').reset(); loadStreams();
            setTimeout(() => msg.innerText = "", 3000);
        } else {
            msg.innerText = "❌ Imeshindikana"; msg.style.color = "red";
        }
    } catch (err) { msg.innerText = "❌ Kosa la mtandao"; msg.style.color = "red"; }
});

document.getElementById('subjectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('subject_name').value;
    const msg = document.getElementById('subject-msg');
    msg.innerText = "Inaongeza..."; msg.style.color = "blue";

    try {
        const res = await fetch('/api/subjects', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name })
        });
        if (res.ok) {
            msg.innerText = "✅ Imeongezwa!"; msg.style.color = "green";
            document.getElementById('subjectForm').reset(); loadSubjects();
            setTimeout(() => msg.innerText = "", 3000);
        } else {
            msg.innerText = "❌ Imeshindikana"; msg.style.color = "red";
        }
    } catch (err) { msg.innerText = "❌ Kosa la mtandao"; msg.style.color = "red"; }
});

document.getElementById('examForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('exam_name').value;
    const msg = document.getElementById('exam-msg');
    msg.innerText = "Inaongeza..."; msg.style.color = "blue";

    try {
        const res = await fetch('/api/exams', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name })
        });
        if (res.ok) {
            msg.innerText = "✅ Imeongezwa!"; msg.style.color = "green";
            document.getElementById('examForm').reset(); loadExams();
            setTimeout(() => msg.innerText = "", 3000);
        } else {
            msg.innerText = "❌ Imeshindikana"; msg.style.color = "red";
        }
    } catch (err) { msg.innerText = "❌ Kosa la mtandao"; msg.style.color = "red"; }
});