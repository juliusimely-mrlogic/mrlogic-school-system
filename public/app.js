const API_BASE = '/api'; 
let token = localStorage.getItem('token');
let currentSchoolId = null;
let allExams = [], allStudents = [], allSubjects = [], allClasses = [], allTeachers = [], currentProcessedData = null;
let currentUserRole = localStorage.getItem('user_role');

if (token) { showDashboard(); }

// (Weka functions zote za Login, Dashboard, Schools, Users kama zilivyokuwa awali)
// ... [Nakili kutoka ujumbe uliopita] ...

async function loadClasses() {
    const res = await fetch(`${API_BASE}/classes?school_id=${currentSchoolId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    allClasses = data.classes || [];
    const options = '<option value="">-- Chagua Darasa --</option>' + allClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    // Nimeongeza 'bulk-class' hapa
    ['student-class', 'exam-class', 'struct-class', 'att-class', 'assign-class', 'bulk-class'].forEach(id => { 
        if(document.getElementById(id)) document.getElementById(id).innerHTML = options; 
    });
    
    const tbody = document.getElementById('classes-table-body');
    if (tbody) tbody.innerHTML = allClasses.map((c, i) => `<tr><td>${i+1}</td><td>${c.name}</td><td>${c.level_type}</td><td><button onclick="deleteClass(${c.id})" class="btn-red">Futa</button></td></tr>`).join('') || '<tr><td colspan="4">Hakuna madarasa.</td></tr>';
}

// ... [Nakili functions zingine za loadStudents, loadExams, n.k.] ...

// MPYA: LOGIC YA KUP AKIA EXCEL
document.getElementById('bulk-upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentSchoolId) return alert("Chagua shule kwanza!");
    
    const fileInput = document.getElementById('excel-file');
    const classId = document.getElementById('bulk-class').value;
    
    if (!fileInput.files.length || !classId) return alert("Chagua faili la Excel na Darasa!");

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('school_id', currentSchoolId);
    formData.append('class_id', classId);

    const statusDiv = document.getElementById('bulk-status');
    statusDiv.innerText = "Inapakia... Tafadhali subiri.";
    statusDiv.style.color = "#e67e22";

    try {
        const res = await fetch(`${API_BASE}/students/bulk`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        
        if (res.ok) {
            statusDiv.innerText = data.message;
            statusDiv.style.color = "#27ae60"; // Kijani
            document.getElementById('bulk-upload-form').reset();
            loadStudents(); // Sasisha orodha ya wanafunzi
        } else {
            statusDiv.innerText = "Kosa: " + data.error;
            statusDiv.style.color = "#e74c3c"; // Nyekundu
        }
    } catch (err) {
        statusDiv.innerText = "Hitilafu ya mtandao wakati wa kupakia.";
        statusDiv.style.color = "#e74c3c";
    }
});

// ... [Nakili function ya showSection kama ilivyokuwa] ...