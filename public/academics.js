const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');

if (!token || !userStr) {
    window.location.replace('/login.html');
}

function logout() {
    localStorage.clear();
    window.location.replace('/login.html');
}

let isEditingStream = false;

document.addEventListener('DOMContentLoaded', () => {
    loadStreams();
    loadSubjects();
    loadExams();
});

// ==========================================
// 1. MADARASA (STREAMS)
// ==========================================
async function loadStreams() {
    const list = document.getElementById('stream-list');
    try {
        const res = await fetch('/api/streams', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        list.innerHTML = data.map(s => `
            <li>
                <div>
                    <strong>${s.name}</strong><br>
                    <small>Ada: ${parseFloat(s.fee_amount || 0).toLocaleString()}</small>
                </div>
                <div class="action-btns">
                    <button class="btn-edit" onclick="editStream(${s.id}, '${s.name}', ${s.fee_amount || 0})">Rekebisha</button>
                    <button class="btn-delete" onclick="deleteStream(${s.id})">Futa</button>
                </div>
            </li>
        `).join('');
    } catch (err) { console.error(err); }
}

function editStream(id, name, fee_amount) {
    isEditingStream = true;
    document.getElementById('stream_id').value = id;
    document.getElementById('stream_name').value = name;
    document.getElementById('stream_fee').value = fee_amount;
    
    document.getElementById('btn-stream').innerText = "Hifadhi Marekebisho";
    document.getElementById('btn-cancel-stream').style.display = 'block';
}

function cancelStreamEdit() {
    isEditingStream = false;
    document.getElementById('streamForm').reset();
    document.getElementById('stream_id').value = '';
    document.getElementById('btn-stream').innerText = "Ongeza Darasa";
    document.getElementById('btn-cancel-stream').style.display = 'none';
}

document.getElementById('streamForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('stream_name').value;
    const fee_amount = document.getElementById('stream_fee').value;
    const id = document.getElementById('stream_id').value;
    const msg = document.getElementById('stream-msg');
    
    msg.innerText = "Inahifadhi..."; msg.style.color = "blue";

    const method = isEditingStream ? 'PUT' : 'POST';
    const url = isEditingStream ? `/api/streams/${id}` : '/api/streams';

    try {
        const res = await fetch(url, {
            method: method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name, fee_amount })
        });
        const data = await res.json();
        
        if (res.ok) {
            msg.innerText = isEditingStream ? "✅ Marekebisho yamehifadhiwa!" : "✅ Imeongezwa!";
            msg.style.color = "green";
            cancelStreamEdit(); 
            loadStreams();
            setTimeout(() => msg.innerText = "", 3000);
        } else {
            msg.innerText = `❌ Kosa: ${data.error}`; msg.style.color = "red";
        }
    } catch (err) { msg.innerText = "❌ Kosa la mtandao"; msg.style.color = "red"; }
});

async function deleteStream(id) {
    if (!confirm("Una uhakika unataka kufuta darasa hili? (Wanafunzi waliopo kwenye darasa hili hawatafutwa, watabaki bila darasa)")) return;
    try {
        const res = await fetch(`/api/streams/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) loadStreams();
        else alert("Imeshindikana kufuta. Kuna data inategemea darasa hili.");
    } catch (err) { console.error(err); }
}

// ==========================================
// 2. MASOMO (SUBJECTS)
// ==========================================
async function loadSubjects() {
    const list = document.getElementById('subject-list');
    try {
        const res = await fetch('/api/subjects', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        list.innerHTML = data.map(s => `<li><span>${s.name}</span></li>`).join('');
    } catch (err) { console.error(err); }
}

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

// ==========================================
// 3. MITIHANI (EXAMS)
// ==========================================
async function loadExams() {
    const list = document.getElementById('exam-list');
    try {
        const res = await fetch('/api/exams', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        list.innerHTML = data.map(s => `<li><span>${s.name}</span></li>`).join('');
    } catch (err) { console.error(err); }
}

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