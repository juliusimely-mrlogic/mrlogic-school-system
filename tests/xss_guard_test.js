const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appPath = path.join(__dirname, '..', 'public', 'js', 'app.js');
const appSource = fs.readFileSync(appPath, 'utf8');

assert.doesNotMatch(
  appSource,
  /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b|\bdocument\.write\b|\beval\s*\(/,
  'app.js must not use executable HTML or eval sinks'
);

for (const functionName of [
  'openReportCardModal',
  'viewStudentProfile',
  'loadSubjectsAndClassesForTeacherForm'
]) {
  const signature = new RegExp(`^  async ${functionName}\\(`, 'm');
  const start = appSource.search(signature);
  assert.notEqual(start, -1, `${functionName} should remain defined`);
  const end = appSource.indexOf('\n  },', start);
  assert.notEqual(end, -1, `${functionName} should have a complete method body`);
  const functionSource = appSource.slice(start, end);
  assert.match(functionSource, /replaceChildren\(/, `${functionName} should replace content with DOM nodes`);
  assert.match(functionSource, /textContent\s*=/, `${functionName} should render values as text`);
  assert.doesNotMatch(
    functionSource,
    /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b/,
    `${functionName} must not use HTML string sinks`
  );
}

assert.match(appSource, /createSafeOption\(/, 'school selector values should use safe option creation');
assert.match(appSource, /createSafeTextLabel\(/, 'teacher subject labels should use text-safe DOM nodes');
assert.match(appSource, /populateClassDropdown\s*\(selectEl/, 'class dropdown should use safe DOM options');
assert.match(appSource, /populateStreamDropdown\s*\(streamSelectEl/, 'stream dropdown should use safe DOM options');

class TestElement {
  constructor(tagName) {
    this.tagName = tagName.toLowerCase();
    this.children = [];
    this.style = {};
    this.className = '';
    this.attributes = {};
    this.checked = false;
    this._textContent = '';
    this.classList = {
      add: (...names) => {
        this.className = [...new Set(`${this.className} ${names.join(' ')}`.trim().split(/\s+/))].join(' ');
      }
    };
  }

  append(...nodes) {
    nodes.forEach((node) => this.appendChild(node));
  }

  appendChild(node) {
    this._textContent = '';
    this.children.push(node);
    return node;
  }

  replaceChildren(...nodes) {
    this.children = [];
    this._textContent = '';
    nodes.forEach((node) => this.appendChild(node));
  }

  set textContent(value) {
    this.children = [];
    this._textContent = String(value ?? '');
  }

  get textContent() {
    return this._textContent + this.children.map((child) => child.textContent).join('');
  }

  get firstElementChild() {
    return this.children.find((child) => child instanceof TestElement) || null;
  }

  get firstChild() {
    return this.children[0] || null;
  }
}

const elements = new Map();
const document = {
  addEventListener() {},
  createElement: (tagName) => new TestElement(tagName),
  createTextNode: (text) => ({ nodeType: 3, textContent: String(text ?? '') }),
  getElementById: (id) => elements.get(id) || null
};
const xssPayload = '<img src=x onerror=alert(1)>';
const apiCalls = [];
const API = {
  async getReportCard(...args) {
    apiCalls.push(['getReportCard', ...args]);
    return {
      student: {
        first_name: xssPayload,
        middle_name: 'Middle',
        last_name: 'Student',
        reg_number: 'REG-1',
        class_name: 'Form 1',
        stream_name: 'A',
        gender: 'M'
      },
      school: { name: xssPayload, address: 'Address', region: 'Region', motto: xssPayload },
      exam: { name: 'Final Exam' },
      summary: { total_marks: 450, average_marks: 75, best_seven_points: 7, division: '2', class_rank: 1, gpa: '1.0' },
      marks: [{ subject_name: xssPayload, subject_code: 'SUB', marks: 75, grade: 'A', points: 1, remarks: xssPayload }],
      totalClassStudents: 27
    };
  },
  async getStudent(...args) {
    apiCalls.push(['getStudent', ...args]);
    return {
      student: {
        first_name: xssPayload,
        middle_name: '',
        last_name: 'Student',
        reg_number: 'REG-2',
        gender: 'F',
        school_name: xssPayload,
        class_name: 'Form 2',
        stream_name: 'B',
        status: 'ACTIVE',
        parent_name: xssPayload,
        parent_phone: '12345',
        enrollments: [{ year_label: '2026', class_name: xssPayload, stream_name: 'A', status: 'ACTIVE' }],
        examResults: [{
          exam_name: xssPayload,
          year_label: '2026',
          term_name: 'Term 1',
          average_marks: 80,
          best_seven_points: 6,
          division: '<svg onload=alert(1)>',
          class_rank: 2
        }]
      }
    };
  },
  async getSubjects(...args) {
    apiCalls.push(['getSubjects', ...args]);
    return { subjects: [{ id: 1, code: 'SUB', name: xssPayload }] };
  },
  async getClasses(...args) {
    apiCalls.push(['getClasses', ...args]);
    return {
      classes: [{
        id: 2,
        name: xssPayload,
        streams: [{ id: 3, name: xssPayload }]
      }]
    };
  }
};
const State = { currentSchool: { id: 9 } };
const context = vm.createContext({ document, API, State, console });
vm.runInContext(appSource, context, { filename: appPath });

const addElement = (id, tagName = 'div') => {
  const element = new TestElement(tagName);
  elements.set(id, element);
  return element;
};
const allElements = (root) => [
  root,
  ...root.children.filter((child) => child instanceof TestElement).flatMap(allElements)
];
const findElements = (root, predicate) => allElements(root).filter(predicate);

const reportModal = addElement('report-card-modal');
const reportBody = addElement('report-card-modal-body');
const reportLoad = vm.runInContext('App.openReportCardModal(12, 34)', context);
assert.equal(reportBody.textContent, 'Loading student report card...', 'report card loading state should render as text');
reportLoad.then(async () => {
  assert.ok(reportModal.className.includes('active'), 'report card modal should still open');
  assert.ok(reportBody.textContent.includes(xssPayload), 'report API values should remain visible as literal text');
  assert.ok(allElements(reportBody).every((element) => element.tagName !== 'img'), 'report API values must not create markup');
  assert.ok(allElements(reportBody).some((element) => element.className === 'report-card-printable'), 'report card CSS hook should be preserved');

  const dossierModal = addElement('student-dossier-modal');
  const dossierBody = addElement('student-dossier-modal-body');
  const editButton = addElement('dossier-edit-btn', 'button');
  const dossierLoad = vm.runInContext('App.viewStudentProfile(56)', context);
  assert.equal(dossierBody.textContent, 'Loading student dossier...', 'dossier loading state should render as text');
  await dossierLoad;
  assert.ok(dossierModal.className.includes('active'), 'student dossier modal should still open');
  assert.ok(typeof editButton.onclick === 'function', 'student dossier edit handler should remain wired');
  assert.ok(dossierBody.textContent.includes(xssPayload), 'student API values should remain visible as literal text');
  assert.ok(allElements(dossierBody).every((element) => element.tagName !== 'img' && element.tagName !== 'svg'), 'student API values must not create markup');
  assert.ok(allElements(dossierBody).some((element) => element.className === 'data-table'), 'dossier table CSS hook should be preserved');

  const subjectsWrap = addElement('subjects-wrap');
  const classesWrap = addElement('classes-wrap');
  const teacherFormLoad = vm.runInContext(
    "App.loadSubjectsAndClassesForTeacherForm('subjects-wrap', 'classes-wrap')",
    context
  );
  assert.equal(subjectsWrap.textContent, 'Loading subjects...', 'subject loading state should render as text');
  assert.equal(classesWrap.textContent, 'Loading classes & streams...', 'class loading state should render as text');
  await teacherFormLoad;
  assert.ok(subjectsWrap.textContent.includes(xssPayload), 'subject names should render as literal text');
  assert.ok(classesWrap.textContent.includes(xssPayload), 'class and stream names should render as literal text');
  assert.ok(allElements(subjectsWrap).every((element) => element.tagName !== 'img'), 'subject data must not create markup');
  assert.ok(allElements(classesWrap).every((element) => element.tagName !== 'img'), 'class and stream data must not create markup');
  assert.deepEqual(
    findElements(subjectsWrap, (element) => element.tagName === 'input').map((input) => [input.type, input.name, input.value]),
    [['checkbox', 'subjectIds', '1']],
    'teacher subject checkbox controls should retain their form name and value'
  );
  assert.deepEqual(
    findElements(classesWrap, (element) => element.tagName === 'input').map((input) => [input.type, input.name, input.value]),
    [['checkbox', 'classAllocations', '2_3']],
    'teacher class allocation controls should retain their form name and value'
  );
  assert.deepEqual(apiCalls, [
    ['getReportCard', 12, 34, 9],
    ['getStudent', 56],
    ['getSubjects', 9],
    ['getClasses', 9]
  ], 'renderers should preserve existing API call contracts');

  API.getReportCard = async () => { throw new Error(xssPayload); };
  await vm.runInContext('App.openReportCardModal(12, 34)', context);
  assert.ok(reportBody.textContent.includes(xssPayload), 'report API errors should remain visible as literal text');
  assert.ok(allElements(reportBody).every((element) => element.tagName !== 'img'), 'report API errors must not create markup');

  API.getStudent = async () => { throw new Error(xssPayload); };
  await vm.runInContext('App.viewStudentProfile(56)', context);
  assert.ok(dossierBody.textContent.includes(xssPayload), 'student API errors should remain visible as literal text');
  assert.ok(allElements(dossierBody).every((element) => element.tagName !== 'img'), 'student API errors must not create markup');

  API.getReportCard = async () => ({});
  await vm.runInContext('App.openReportCardModal(12, 34)', context);
  assert.ok(reportBody.textContent.includes('Division 0'), 'missing report-card optionals should render documented fallback text');
  assert.ok(reportBody.textContent.includes('#- / -'), 'missing report-card rank data should render its placeholder');
  assert.equal(findElements(reportBody, (element) => element.tagName === 'tr').length, 1, 'empty report marks should render a header row and no data rows');
  assert.ok(allElements(reportBody).every((element) => element.tagName !== 'img' && element.tagName !== 'svg'), 'empty report data must not create markup');

  API.getStudent = async () => ({ student: {} });
  await vm.runInContext('App.viewStudentProfile(56)', context);
  assert.ok(dossierBody.textContent.includes('No past examination records available.'), 'empty exam results should render the existing empty-state message');
  assert.equal(findElements(dossierBody, (element) => element.tagName === 'tr').length, 1, 'empty enrollments should render a header row and no data rows');
  assert.ok(allElements(dossierBody).every((element) => element.tagName !== 'img' && element.tagName !== 'svg'), 'empty student data must not create markup');

  API.getSubjects = async () => ({ subjects: [] });
  API.getClasses = async () => ({ classes: [] });
  await vm.runInContext(
    "App.loadSubjectsAndClassesForTeacherForm('subjects-wrap', 'classes-wrap')",
    context
  );
  assert.equal(subjectsWrap.textContent, 'No subjects registered in this school.', 'empty subject lists should render their existing placeholder');
  assert.equal(classesWrap.textContent, 'No classes registered.', 'empty class lists should render their existing placeholder');
  assert.ok(allElements(subjectsWrap).every((element) => element.tagName !== 'img'), 'empty subject data must not create markup');
  assert.ok(allElements(classesWrap).every((element) => element.tagName !== 'img'), 'empty class data must not create markup');

  API.getSubjects = async () => { throw new Error(xssPayload); };
  API.getClasses = async () => ({ classes: [] });
  await assert.doesNotReject(
    vm.runInContext(
      "App.loadSubjectsAndClassesForTeacherForm('subjects-wrap', 'classes-wrap')",
      context
    ),
    'teacher loader should handle rejected API requests without throwing'
  );
  assert.equal(subjectsWrap.textContent, 'Error loading subjects.', 'subject request failures should render the existing text status');
  assert.equal(classesWrap.textContent, 'Error loading classes.', 'failed parallel load should render the existing class error status');
  assert.ok(allElements(subjectsWrap).every((element) => element.tagName !== 'img'), 'subject error state must not create markup');
  assert.ok(allElements(classesWrap).every((element) => element.tagName !== 'img'), 'class error state must not create markup');

  API.getSubjects = async () => ({ subjects: [{ id: 4, code: 'BIO', name: 'Biology' }] });
  API.getClasses = async () => ({ classes: [{ id: 5, name: 'Form 5', streams: [{ id: 6, name: 'Stream A' }] }] });
  await vm.runInContext(
    "App.loadSubjectsAndClassesForTeacherForm('subjects-wrap', 'classes-wrap', [4], ['5_6'])",
    context
  );
  assert.deepEqual(
    findElements(subjectsWrap, (element) => element.tagName === 'input').map((input) => [input.name, input.value, input.checked]),
    [['subjectIds', '4', true]],
    'teacher subject controls and selected state should be restored after a failed request'
  );
  assert.deepEqual(
    findElements(classesWrap, (element) => element.tagName === 'input').map((input) => [input.name, input.value, input.checked]),
    [['classAllocations', '5_6', true]],
    'teacher class controls and selected state should be restored after a failed request'
  );

  console.log('[PASS] XSS DOM-construction regression checks passed (mock DOM; not browser validation)');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
