App.handleCreateExamSubmit = async function(e) {
    e.preventDefault();
    
    const classVal = document.getElementById('exam-class').value;
    const yearVal = document.getElementById('exam-year').value;
    const termVal = document.getElementById('exam-term').value;

    if (!classVal || !yearVal || !termVal) {
        alert("Tafadhali chagua Class, Academic Year, na Term kwanza kabla ya kusave!");
        return;
    }

    const data = { 
        name: document.getElementById('exam-name').value, 
        examType: document.getElementById('exam-type').value, 
        classId: parseInt(classVal, 10), 
        academicYearId: parseInt(yearVal, 10), 
        termId: parseInt(termVal, 10), 
        startDate: document.getElementById('exam-start-date').value || null, 
        endDate: document.getElementById('exam-end-date').value || null 
    };
    
    console.log("DATA HALISI INAYOTUMWA:", data);

    try {
        await API.request('/api/exams', { method: 'POST', body: data });
        alert('Mtihani umesajiliwa kikamilifu!'); 
        this.closeModal('new-exam-modal'); 
        e.target.reset(); 
        this.render(); 
    } catch (err) { 
        alert('Kosa la kusajili: ' + err.message); 
    }
};