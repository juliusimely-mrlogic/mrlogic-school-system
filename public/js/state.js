/**
 * MR LOGIC SCHOOL SYSTEM - Global Application State
 */
const State = {
  currentUser: null,
  currentSchool: null,
  activeRole: 'SUPER_ADMIN',
  activeView: 'dashboard',
  schools: [],
  classes: [],
  subjects: [],
  exams: [],
  selectedExam: null,
  listeners: [],

  subscribe(listener) {
    this.listeners.push(listener);
  },

  notify() {
    for (const listener of this.listeners) {
      listener(this);
    }
  },

  setUser(user) {
    this.currentUser = user;
    if (user && user.role) {
      this.activeRole = user.role;
    }
    this.notify();
  },

  setSchool(school) {
    this.currentSchool = school;
    if (school) {
      API.setActiveSchoolId(school.id);
    }
    this.notify();
  },

  setView(viewName) {
    this.activeView = viewName;
    this.notify();
  }
};
