/**
 * MR LOGIC SCHOOL SYSTEM - API Client
 */
const API = {
  baseUrl: '',
  
  getToken() { return localStorage.getItem('mr_logic_token') || ''; },
  
  setToken(token) {
    if (token) localStorage.setItem('mr_logic_token', token);
    else localStorage.removeItem('mr_logic_token');
  },

  getActiveSchoolId() {
    let val = localStorage.getItem('active_school_id');
    if (!val || val === '[object Object]') return null;
    try {
        const parsed = JSON.parse(val);
        if (typeof parsed === 'object' && parsed.id) return parsed.id;
    } catch(e) {}
    return val;
  },

  setActiveSchoolId(id) {
    if (!id) return localStorage.removeItem('active_school_id');
    const actualId = typeof id === 'object' ? id.id : id;
    if (actualId) localStorage.setItem('active_school_id', actualId);
    else localStorage.removeItem('active_school_id');
  },

  _extractId(val) {
      if (!val) return null;
      if (typeof val === 'object') return val.id || null;
      return val;
  },

  async request(url, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let finalOptions = { ...options, headers };
    if (options.body && typeof options.body === 'object') {
      finalOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, finalOptions);
    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      const error = new Error(data.error || `Request failed with status ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  },

  // Auth & Schools
  getMe() { return this.request('/api/auth/me'); },
  login(credentials) { return this.request('/api/auth/login', { method: 'POST', body: credentials }); },
  getSchools() { return this.request('/api/schools'); },
  createSchool(data) { return this.request('/api/schools', { method: 'POST', body: data }); },
  updateSchool(id, data) { return this.request('/api/schools/' + id, { method: 'PUT', body: data }); },

  // Dashboard
  getDashboard(schoolId) {
    const id = this._extractId(schoolId) || this.getActiveSchoolId();
    return this.request(`/api/dashboard${id ? `?school_id=${id}` : ''}`);
  },

  // Academics
  getClasses(schoolId) {
    const id = this._extractId(schoolId) || this.getActiveSchoolId();
    return this.request(`/api/academics/classes${id ? `?school_id=${id}` : ''}`);
  },
  getYears(schoolId) {
    const id = this._extractId(schoolId) || this.getActiveSchoolId();
    return this.request(`/api/academics/years${id ? `?school_id=${id}` : ''}`);
  },
  getTerms(yearId = '', schoolId = '') {
    const sId = this._extractId(schoolId) || this.getActiveSchoolId();
    let url = '/api/academics/terms?';
    if (yearId) url += `year_id=${yearId}&`;
    if (sId) url += `school_id=${sId}`;
    return this.request(url);
  },
  // Students
getStudent(id, schoolId) {
  const sId = this._extractId(schoolId) || this.getActiveSchoolId();
  return this.request(`/api/students/${id}${sId ? `?school_id=${sId}` : ''}`);
},

createStudent(data, schoolId) {
  const id = this._extractId(schoolId) || this.getActiveSchoolId();
  return this.request(`/api/students${id ? `?school_id=${id}` : ''}`, { method: 'POST', body: data });
},

updateStudent(id, data, schoolId) {
  const sId = this._extractId(schoolId) || this.getActiveSchoolId();
  return this.request(`/api/students/${id}${sId ? `?school_id=${sId}` : ''}`, { method: 'PUT', body: data });
},

deleteStudent(id, schoolId) {
  const sId = this._extractId(schoolId) || this.getActiveSchoolId();
  return this.request(`/api/students/${id}${sId ? `?school_id=${sId}` : ''}`, { method: 'DELETE' });
},

getStudentDossier(id, schoolId) {
  const sId = this._extractId(schoolId) || this.getActiveSchoolId();
  return this.request(`/api/students/${id}/dossier${sId ? `?school_id=${sId}` : ''}`);
},
  getSubjects(schoolId) {
    const id = this._extractId(schoolId) || this.getActiveSchoolId();
    return this.request(`/api/academics/subjects${id ? `?school_id=${id}` : ''}`);
  },
  getStreams(classId = '', schoolId = '') {
    const sId = this._extractId(schoolId) || this.getActiveSchoolId();
    let url = '/api/academics/streams?';
    if (classId) url += `class_id=${classId}&`;
    if (sId) url += `school_id=${sId}`;
    return this.request(url);
  },

  // Teachers & Students
  getTeachers(schoolId) {
    const id = this._extractId(schoolId) || this.getActiveSchoolId();
    return this.request(`/api/teachers${id ? `?school_id=${id}` : ''}`);
  },
  getStudents(schoolId) {
    const id = this._extractId(schoolId) || this.getActiveSchoolId();
    return this.request(`/api/students${id ? `?school_id=${id}` : ''}`);
  },
  getTeacher(id, schoolId) {
  const sId = this._extractId(schoolId) || this.getActiveSchoolId();
  return this.request(`/api/teachers/${id}${sId ? `?school_id=${sId}` : ''}`);
},

createTeacher(data, schoolId) {
  const id = this._extractId(schoolId) || this.getActiveSchoolId();
  return this.request(`/api/teachers${id ? `?school_id=${id}` : ''}`, { method: 'POST', body: data });
},

updateTeacher(id, data, schoolId) {
  const sId = this._extractId(schoolId) || this.getActiveSchoolId();
  return this.request(`/api/teachers/${id}${sId ? `?school_id=${sId}` : ''}`, { method: 'PUT', body: data });
},

deleteTeacher(id, schoolId) {
  const sId = this._extractId(schoolId) || this.getActiveSchoolId();
  return this.request(`/api/teachers/${id}${sId ? `?school_id=${sId}` : ''}`, { method: 'DELETE' });
},
  // Examinations
  getExams(schoolId) {
    const id = this._extractId(schoolId) || this.getActiveSchoolId();
    return this.request(`/api/exams${id ? `?school_id=${id}` : ''}`);
  },
  createExam(data) {
    const schoolId = this.getActiveSchoolId();
    return this.request(`/api/exams${schoolId ? `?school_id=${schoolId}` : ''}`, { method: 'POST', body: data });
  },
  toggleExamLock(examId, isLocked) {
    return this.request(`/api/exams/${examId}/lock`, { method: 'POST', body: { isLocked } });
  },

  // Marks Entry & Processing
  getMarksSheet(examId, subjectId, streamId = null) {
    let url = `/api/exams/${examId}/marks?subject_id=${subjectId}`;
    if (streamId) url += `&stream_id=${streamId}`;
    return this.request(url);
  },
  saveMarks(examId, subjectId, marks) {
    return this.request(`/api/exams/${examId}/marks`, { method: 'POST', body: { subjectId, marks } });
  },
  processExam(examId) {
    return this.request(`/api/exams/${examId}/process`, { method: 'POST' });
  },

  // Reports
  getBroadsheet(examId) {
    return this.request(`/api/reports/broadsheet/${examId}`);
  },
  getReportCard(examId, studentId) {
    return this.request(`/api/reports/report-card/${examId}/${studentId}`);
  }
};