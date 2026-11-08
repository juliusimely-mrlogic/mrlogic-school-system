/**
 * MR LOGIC SCHOOL SYSTEM - Main Client Application Logic
 */

function createSafeOption(value, label) {
  const option = document.createElement('option');
  option.value = String(value);
  option.textContent = String(label ?? '');
  return option;
}

function createSafeTextLabel(code, name, options = {}) {
  const wrapper = document.createElement('span');
  const strong = document.createElement('strong');
  strong.textContent = String(code ?? '');
  wrapper.appendChild(strong);

  const text = document.createTextNode(` - ${String(name ?? '')}`);
  wrapper.appendChild(text);

  if (options.className) {
    wrapper.className = options.className;
  }
  if (options.style) {
    Object.assign(wrapper.style, options.style);
  }

  return wrapper;
}

function createTextNodeSafe(value) {
  return document.createTextNode(value == null ? '' : String(value));
}

function createStrongText(value) {
  const el = document.createElement('strong');
  el.textContent = value == null ? '' : String(value);
  return el;
}

function setText(node, value) {
  node.textContent = value == null ? '' : String(value);
  return node;
}

function createLoadingState(message) {
  const wrap = document.createElement('div');
  wrap.style.textAlign = 'center';
  wrap.style.padding = '48px';

  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  spinner.style.fontSize = '2rem';
  spinner.textContent = '⏳';

  const label = document.createElement('p');
  label.style.color = 'var(--slate-500)';
  label.style.marginTop = '8px';
  label.textContent = message;

  wrap.appendChild(spinner);
  wrap.appendChild(label);
  return wrap;
}

function createErrorState(message, options = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'card';
  wrap.style.padding = options.padding ?? '24px';
  wrap.style.color = 'var(--danger)';
  wrap.textContent = message;
  return wrap;
}

function createBadge(label, className = '', style = null) {
  const badge = document.createElement('span');
  badge.className = className ? `badge ${className}` : 'badge';
  if (style) Object.assign(badge.style, style);
  badge.textContent = String(label ?? '');
  return badge;
}

function getDivisionBadgeClass(division) {
  const value = String(division ?? '0').toLowerCase();
  return ['0', '1', '2', '3', '4'].includes(value) ? `badge-div-${value}` : 'badge-div-0';
}

function createActionButton(label, options = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = options.className || 'btn btn-secondary btn-sm';
  if (options.title) btn.title = options.title;
  if (options.style) Object.assign(btn.style, options.style);
  if (options.onclick) btn.onclick = options.onclick;
  btn.textContent = label;
  return btn;
}

document.addEventListener('DOMContentLoaded', async () => {
  await App.init();
});

const App = {
  async init() {
    this.setupEventListeners();
    let authRes;
    try {
      authRes = await API.getMe();
    } catch (err) {
      if (err.status !== 401) {
        console.error('Failed to validate the current session:', err);
        this.showLogin('Unable to connect to the system. Please try again.');
        return;
      }
    }

    if (!authRes?.user) {
      API.setToken(null);
      this.showLogin();
      return;
    }

    State.setUser(authRes.user);
    try {
      await this.loadInitialData();
      this.showAuthenticatedApp();
      this.render();
    } catch (err) {
      console.error('Failed to load initial platform data:', err);
      this.showLogin('Unable to load system data. Please try again.');
    }
  },

  setupEventListeners() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', event => this.handleLogin(event));
    }

    const logoutButton = document.getElementById('logout-btn');
    if (logoutButton) {
      logoutButton.addEventListener('click', () => this.logout());
    }

    // School selector dropdown
    const schoolSelect = document.getElementById('school-selector');
    if (schoolSelect) {
      schoolSelect.addEventListener('change', async (e) => {
        const schoolId = parseInt(e.target.value, 10);
        await this.switchSchool(schoolId);
      });
    }

    // Sidebar navigation items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const view = e.currentTarget.getAttribute('data-view');
        if (view) {
          this.navigateTo(view);
          this.closeMobileSidebar();
        }
      });
    });

    // Mobile bottom navigation items
    document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.getAttribute('data-view');
        if (view === 'menu') {
          this.toggleMobileSidebar();
        } else if (view) {
          this.navigateTo(view);
        }
      });
    });

    // Hamburger toggle
    const hamburger = document.getElementById('hamburger-btn');
    if (hamburger) {
      hamburger.addEventListener('click', () => this.toggleMobileSidebar());
    }

    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => this.closeMobileSidebar());
    }
  },

  toggleMobileSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  },

  closeMobileSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = document.createElement('span');
    icon.textContent = '🔔';

    const text = document.createElement('span');
    text.textContent = String(message ?? '');

    toast.appendChild(icon);
    toast.appendChild(text);
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  async loadInitialData() {
    // Fetch schools only after the current session has been authenticated.
    const schoolsData = await API.getSchools();
    State.schools = schoolsData.schools || [];

    const schoolSelect = document.getElementById('school-selector');
    if (schoolSelect) {
      schoolSelect.replaceChildren();
      const schoolOptions = State.schools.map(s => createSafeOption(s.id, `${s.name} (${s.code})`));
      schoolOptions.forEach(option => schoolSelect.appendChild(option));
    }

    const preferredSchoolId = State.currentUser?.school_id || API.getActiveSchoolId();
    const activeSchool = State.schools.find(s => s.id === Number(preferredSchoolId)) || State.schools[0];
    State.setSchool(activeSchool || null);

    if (schoolSelect && activeSchool) {
      schoolSelect.value = String(activeSchool.id);
    }
  },

  async handleLogin(e) {
  e.preventDefault(); // Hii inazuia ukurasa kujirefresh na kuweka password kwenye URL
  
  // Chukua taarifa kutoka kwenye fomu (Hakikisha IDs hizi zinaoana na HTML yako)
  const usernameInput = document.getElementById('username') || document.getElementById('login-username');
  const passwordInput = document.getElementById('password') || document.getElementById('login-password');
  
  if (!usernameInput || !passwordInput) {
      alert("Kosa: Hakikisha sehemu za username na password zina ID sahihi kwenye HTML");
      return;
  }

  const credentials = {
    username: usernameInput.value,
    password: passwordInput.value
  };

  try {
    const response = await API.login(credentials);
    
    // Hifadhi token
    if (response && response.token) {
        API.setToken(response.token);
        // Refresh ukurasa ili mfumo usome mtumiaji mpya
        window.location.reload();
    } else {
        alert("Kuingia kimeshindikana. Hakuna token iliyopatikana.");
    }
  } catch (err) {
    alert('Kosa la kuingia: ' + err.message);
  }
},

logout() {
  API.setToken(null);
  State.setUser(null);
  this.showLogin();
},

  showLogin(message = '') {
    document.getElementById('login-screen').hidden = false;
    document.getElementById('app-layout').hidden = true;
    document.querySelector('.mobile-bottom-nav').hidden = true;
    const errorElement = document.getElementById('login-error');
    errorElement.textContent = message;
    errorElement.hidden = !message;
  },

  showAuthenticatedApp() {
    document.getElementById('login-screen').hidden = true;
    document.getElementById('app-layout').hidden = false;
    document.querySelector('.mobile-bottom-nav').hidden = false;
  },

  async switchSchool(schoolId) {
    try {
      const school = State.schools.find(s => s.id === schoolId);
      if (school) {
        State.setSchool(school);
        this.showToast(`Switched active school to ${school.name}`, 'info');
        this.render();
      }
    } catch (err) {
      this.showToast(`Error switching school: ${err.message}`, 'danger');
    }
  },

  updateRoleUI() {
    const roleTag = document.getElementById('user-role-tag');
    if (roleTag) {
      roleTag.innerText = State.activeRole.replace('_', ' ');
    }

    const userName = document.getElementById('user-name');
    if (userName) {
      userName.innerText = State.currentUser?.full_name || 'Admin User';
    }

    const schoolBadge = document.getElementById('current-school-name');
    if (schoolBadge && State.currentSchool) {
      schoolBadge.innerText = State.currentSchool.name;
    }
  },

  navigateTo(viewName) {
    State.setView(viewName);

    // Update sidebar active classes
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update bottom nav active classes
    document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
      if (btn.getAttribute('data-view') === viewName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    this.render();
  },

  render() {
    this.updateRoleUI();
    const content = document.getElementById('content-area');
    if (!content) return;

    switch (State.activeView) {
      case 'dashboard':
        this.renderDashboard(content);
        break;
      case 'students':
        this.renderStudents(content);
        break;
      case 'teachers':
        this.renderTeachers(content);
        break;
      case 'academics':
        this.renderAcademics(content);
        break;
      case 'exams':
        this.renderExams(content);
        break;
      case 'marks':
        this.renderMarks(content);
        break;
      case 'broadsheet':
        this.renderBroadsheet(content);
        break;
      default:
        this.renderDashboard(content);
    }
  },

  /* =====================================================================
     1. DASHBOARD VIEW
     ===================================================================== */
  async renderDashboard(container) {
    container.replaceChildren(createLoadingState('Loading MR LOGIC Dashboard metrics...'));

    try {
      const data = await API.getDashboard(State.currentSchool?.id);
      const school = data.school || State.currentSchool;
      const stats = data.stats || {};
      const latestExam = data.latestExam;
      const topStudents = data.topStudents || [];
      const subjects = data.subjectRanking || [];

      const root = document.createElement('div');

      const hero = document.createElement('div');
      hero.className = 'school-hero-banner';

      const heroLeft = document.createElement('div');
      heroLeft.className = 'hero-left';

      const emblem = document.createElement('div');
      emblem.className = 'school-emblem';
      emblem.textContent = '🏫';

      const titleArea = document.createElement('div');
      titleArea.className = 'hero-title-area';

      const title = document.createElement('h2');
      title.textContent = school?.name || 'MR LOGIC SCHOOL SYSTEM';
      const moto = document.createElement('div');
      moto.className = 'hero-motto';
      moto.textContent = `"${school?.motto || 'Elimu ni Mwanga na Nguvu'}"`;

      const meta = document.createElement('div');
      meta.className = 'hero-meta-badges';
      [
        `📍 ${school?.district || 'Moshi'}, ${school?.region || 'Kilimanjaro'}`,
        `📜 Reg No: ${school?.registration_number || 'S.1042/2012'}`,
        '📅 Year 2026 • Term 1',
        '✓ NECTA CSEE Enabled'
      ].forEach((item, idx) => {
        const pill = document.createElement('span');
        pill.className = 'hero-meta-pill';
        if (idx === 3) {
          pill.style.background = 'rgba(16, 185, 129, 0.25)';
          pill.style.color = '#a7f3d0';
        }
        pill.textContent = item;
        meta.appendChild(pill);
      });

      titleArea.appendChild(title);
      titleArea.appendChild(moto);
      titleArea.appendChild(meta);
      heroLeft.appendChild(emblem);
      heroLeft.appendChild(titleArea);

      const heroActions = document.createElement('div');
      heroActions.style.display = 'flex';
      heroActions.style.gap = '10px';
      heroActions.style.flexWrap = 'wrap';

      const registerBtn = createActionButton('', { className: 'btn btn-emerald', onclick: () => App.openNewStudentModal() });
      const registerPlus = document.createElement('span');
      registerPlus.textContent = '+';
      const registerText = createTextNodeSafe(' Register Student');
      registerBtn.append(registerPlus, registerText);
      const examsBtn = createActionButton('', { className: 'btn btn-secondary', onclick: () => App.navigateTo('exams') });
      const examIcon = document.createElement('span');
      examIcon.textContent = '📝';
      const examText = createTextNodeSafe(' View Examinations');
      examsBtn.append(examIcon, examText);
      heroActions.appendChild(registerBtn);
      heroActions.appendChild(examsBtn);
      hero.appendChild(heroLeft);
      hero.appendChild(heroActions);
      root.appendChild(hero);

      const kpiGrid = document.createElement('div');
      kpiGrid.className = 'kpi-grid';
      const cards = [
        { title: 'Active Students', icon: '👨‍🎓', className: 'icon-blue', value: String(stats.totalStudents || 0), footer: Charts.renderGenderRatio(stats.boysCount || 0, stats.girlsCount || 0) },
        { title: 'Teachers & Staff', icon: '👩‍🏫', className: 'icon-emerald', value: String(stats.totalTeachers || 0), footer: '<span style="color: var(--emerald-600); font-weight: 600;">✓ Fully Allocated</span> to Subjects' },
        { title: 'Forms & Streams', icon: '📚', className: 'icon-amber', value: 'Forms 1–4', footer: `${stats.totalClasses || 4} Classes • ${stats.totalStreams || 8} Streams` },
        { title: 'Examinations', icon: '📈', className: 'icon-purple', value: String(stats.totalExams || 0), footer: '<span class="badge badge-success">NECTA Processed</span>' }
      ];
      cards.forEach(card => {
  const item = document.createElement('div');
  item.className = 'kpi-card';

  const header = document.createElement('div');
  header.className = 'kpi-header';

  const label = document.createElement('span');
  label.className = 'kpi-title';
  label.textContent = card.title;

  const iconWrap = document.createElement('div');
  iconWrap.className = `kpi-icon-wrap ${card.className}`;
  iconWrap.textContent = card.icon;

  header.appendChild(label);
  header.appendChild(iconWrap);

  const valueDiv = document.createElement('div');
  valueDiv.className = 'kpi-value';
  valueDiv.innerHTML = card.value; // Hapa tumetumia innerHTML

  item.appendChild(header);
  item.appendChild(valueDiv);
  
  // Hakikisha kuna mahali panapoongeza item kwenye grid
  if (typeof kpiGrid !== 'undefined') {
      kpiGrid.appendChild(item);
  }
});
      root.appendChild(kpiGrid);

      const analytics = document.createElement('div');
      analytics.className = 'analytics-two-col';

      const leftCard = document.createElement('div');
      leftCard.className = 'card';
      const leftHeader = document.createElement('div');
      leftHeader.className = 'card-header';
      const leftTitleWrap = document.createElement('div');
      const leftTitle = document.createElement('h3');
      leftTitle.className = 'card-title';
      leftTitle.textContent = 'NECTA Division Performance';
      const leftSubtitle = document.createElement('div');
      leftSubtitle.className = 'card-subtitle';
      leftSubtitle.textContent = `${latestExam?.name || 'Latest Examination'} (O-Level)`;
      leftTitleWrap.appendChild(leftTitle);
      leftTitleWrap.appendChild(leftSubtitle);
      const leftBtn = createActionButton('View Broadsheet', { className: 'btn btn-secondary btn-sm', onclick: () => App.navigateTo('broadsheet') });
      leftHeader.appendChild(leftTitleWrap);
      leftHeader.appendChild(leftBtn);
      const leftBody = document.createElement('div');
      leftBody.className = 'card-body';
      const divisionDistribution = data.divisionDistribution || { total: 0 };
      if (!divisionDistribution || divisionDistribution.total === 0) {
        const empty = document.createElement('div');
        empty.className = 'card-subtitle';
        empty.style.textAlign = 'center';
        empty.style.padding = '24px';
        empty.textContent = 'No examination results processed yet.';
        leftBody.appendChild(empty);
      } else {
        const list = document.createElement('div');
        list.className = 'division-bars-list';
        const divs = [
          { key: 'I', label: 'Division I', className: 'fill-div-1', count: divisionDistribution['I'] || 0 },
          { key: 'II', label: 'Division II', className: 'fill-div-2', count: divisionDistribution['II'] || 0 },
          { key: 'III', label: 'Division III', className: 'fill-div-3', count: divisionDistribution['III'] || 0 },
          { key: 'IV', label: 'Division IV', className: 'fill-div-4', count: divisionDistribution['IV'] || 0 },
          { key: '0', label: 'Division 0', className: 'fill-div-0', count: divisionDistribution['0'] || 0 }
        ];
        const total = Number(divisionDistribution.total) || 0;
        divs.forEach(d => {
          const row = document.createElement('div');
          row.className = 'division-bar-row';
          const labelCol = document.createElement('div');
          labelCol.className = 'div-label-col';
          const badge = document.createElement('span');
          badge.className = `badge badge-div-${d.key === '0' ? '0' : d.key.toLowerCase()}`;
          badge.textContent = d.label;
          labelCol.appendChild(badge);
          const track = document.createElement('div');
          track.className = 'div-progress-track';
          const fill = document.createElement('div');
          fill.className = `div-progress-fill ${d.className}`;
          const pct = total > 0 ? ((d.count / total) * 100).toFixed(1) : '0';
          fill.style.width = `${pct}%`;
          track.appendChild(fill);
          const statCol = document.createElement('div');
          statCol.className = 'div-stat-col';
          statCol.appendChild(document.createTextNode(String(d.count)));
          const small = document.createElement('small');
          small.style.color = 'var(--slate-400)';
          small.style.fontWeight = 'normal';
          small.textContent = ` (${pct}%)`;
          statCol.appendChild(small);
          row.append(labelCol, track, statCol);
          list.appendChild(row);
        });
        leftBody.appendChild(list);
      }
      leftCard.appendChild(leftHeader);
      leftCard.appendChild(leftBody);

      const rightCard = document.createElement('div');
      rightCard.className = 'card';
      const rightHeader = document.createElement('div');
      rightHeader.className = 'card-header';
      const rightTitleWrap = document.createElement('div');
      const rightTitle = document.createElement('h3');
      rightTitle.className = 'card-title';
      rightTitle.textContent = 'Top Outstanding Students';
      const rightSubtitle = document.createElement('div');
      rightSubtitle.className = 'card-subtitle';
      rightSubtitle.textContent = 'Highest Best-7 Points & GPA Rankings';
      rightTitleWrap.appendChild(rightTitle);
      rightTitleWrap.appendChild(rightSubtitle);
      const rightBadge = createBadge('Top 5', 'badge-success');
      rightHeader.appendChild(rightTitleWrap);
      rightHeader.appendChild(rightBadge);
      const rightBody = document.createElement('div');
      rightBody.className = 'card-body';
      rightBody.style.padding = '0';
      const tableWrap = document.createElement('div');
      tableWrap.className = 'table-responsive';
      const table = document.createElement('table');
      table.className = 'data-table';
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      ['Rank', 'Candidate Name', 'Reg No', 'Points', 'Div', 'Avg', 'GPA'].forEach(label => {
        const th = document.createElement('th');
        th.textContent = label;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      const tbody = document.createElement('tbody');
      topStudents.forEach((s, index) => {
        const tr = document.createElement('tr');
        const rank = document.createElement('td');
        const rankStrong = document.createElement('strong');
        rankStrong.textContent = `#${s.class_rank}`;
        rank.appendChild(rankStrong);
        const nameCell = document.createElement('td');
        const nameStrong = document.createElement('strong');
        nameStrong.textContent = `${s.first_name || ''} ${s.last_name || ''}`.trim();
        const gender = createBadge(s.gender, s.gender === 'M' ? 'badge-male' : 'badge-female', { marginLeft: '4px' });
        nameCell.appendChild(nameStrong);
        nameCell.appendChild(gender);
        const regCell = document.createElement('td');
        const regSmall = document.createElement('small');
        regSmall.style.color = 'var(--slate-500)';
        regSmall.textContent = s.reg_number || '';
        regCell.appendChild(regSmall);
        const pointsCell = document.createElement('td');
        const pointsStrong = document.createElement('strong');
        pointsStrong.textContent = s.best_seven_points ?? '';
        pointsCell.appendChild(pointsStrong);
        const divCell = document.createElement('td');
        const divBadge = createBadge(`Div ${s.division || '0'}`, `badge-div-${s.division === '0' ? '0' : String(s.division).toLowerCase()}`);
        divCell.appendChild(divBadge);
        const avgCell = document.createElement('td');
        const avgStrong = document.createElement('strong');
        avgStrong.textContent = `${s.average_marks ?? ''}%`;
        avgCell.appendChild(avgStrong);
        const gpaCell = document.createElement('td');
        gpaCell.textContent = s.gpa ?? '';
        tr.append(rank, nameCell, regCell, pointsCell, divCell, avgCell, gpaCell);
        tbody.appendChild(tr);
      });
      table.appendChild(thead);
      table.appendChild(tbody);
      tableWrap.appendChild(table);
      rightBody.appendChild(tableWrap);
      rightCard.appendChild(rightHeader);
      rightCard.appendChild(rightBody);
      analytics.appendChild(leftCard);
      analytics.appendChild(rightCard);
      root.appendChild(analytics);

      const subjectCard = document.createElement('div');
      subjectCard.className = 'card';
      const subjectHeader = document.createElement('div');
      subjectHeader.className = 'card-header';
      const subjectTitleWrap = document.createElement('div');
      const subjectTitle = document.createElement('h3');
      subjectTitle.className = 'card-title';
      subjectTitle.textContent = 'Subject Performance Analysis';
      const subjectSubtitle = document.createElement('div');
      subjectSubtitle.className = 'card-subtitle';
      subjectSubtitle.textContent = `Ranked by Pass Rate % in ${latestExam?.name || 'Examinations'}`;
      subjectTitleWrap.appendChild(subjectTitle);
      subjectTitleWrap.appendChild(subjectSubtitle);
      const subjectBtn = createActionButton('Record Marks', { className: 'btn btn-secondary btn-sm', onclick: () => App.navigateTo('marks') });
      subjectHeader.appendChild(subjectTitleWrap);
      subjectHeader.appendChild(subjectBtn);
      const subjectBody = document.createElement('div');
      subjectBody.className = 'card-body';
      const subjectGrid = document.createElement('div');
      subjectGrid.style.display = 'grid';
      subjectGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
      subjectGrid.style.gap = '16px';
      subjects.slice(0, 6).forEach(sub => {
        const cardItem = document.createElement('div');
        cardItem.style.background = 'var(--slate-50)';
        cardItem.style.padding = '14px';
        cardItem.style.borderRadius = 'var(--radius-md)';
        cardItem.style.border = '1px solid var(--slate-200)';
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.marginBottom = '8px';
        const subjectMeta = document.createElement('div');
        const subBadge = document.createElement('span');
        subBadge.className = 'sub-code-badge';
        subBadge.textContent = sub.code || '';
        const nameStrong = document.createElement('strong');
        nameStrong.style.marginLeft = '6px';
        nameStrong.style.fontSize = '0.9rem';
        nameStrong.textContent = sub.name || '';
        subjectMeta.appendChild(subBadge);
        subjectMeta.appendChild(nameStrong);
        const passPill = document.createElement('span');
        passPill.className = 'pass-rate-pill';
        passPill.textContent = `${sub.pass_rate ?? 0}% Pass`;
        row.appendChild(subjectMeta);
        row.appendChild(passPill);
        const statsRow = document.createElement('div');
        statsRow.style.display = 'flex';
        statsRow.style.justifyContent = 'space-between';
        statsRow.style.fontSize = '0.78rem';
        statsRow.style.color = 'var(--slate-600)';
        statsRow.style.marginTop = '6px';
        const avg = document.createElement('span');
        avg.appendChild(document.createTextNode('Average: '));
        avg.appendChild(createStrongText(`${sub.average_mark ?? 0}%`));
        const candidates = document.createElement('span');
        candidates.appendChild(document.createTextNode('Candidates: '));
        candidates.appendChild(createStrongText(String(sub.candidates ?? 0)));
        const gpa = document.createElement('span');
        gpa.appendChild(document.createTextNode('Subject GPA: '));
        gpa.appendChild(createStrongText(String(sub.subject_gpa ?? 0)));
        statsRow.appendChild(avg);
        statsRow.appendChild(candidates);
        statsRow.appendChild(gpa);
        cardItem.appendChild(row);
        cardItem.appendChild(statsRow);
        subjectGrid.appendChild(cardItem);
      });
      subjectBody.appendChild(subjectGrid);
      subjectCard.appendChild(subjectHeader);
      subjectCard.appendChild(subjectBody);
      root.appendChild(subjectCard);
      container.replaceChildren(root);
    } catch (err) {
      container.replaceChildren(createErrorState(`Failed to load dashboard: ${err.message}`));
    }
  },


  /* =====================================================================
     2. STUDENTS VIEW
     ===================================================================== */
  async renderStudents(container) {
    container.replaceChildren(createLoadingState('Loading Students Directory...'));

    try {
      const data = await API.getStudents({ school_id: State.currentSchool?.id });
      const students = data.students || [];

      const card = document.createElement('div');
      card.className = 'card';

      const header = document.createElement('div');
      header.className = 'card-header';
      const left = document.createElement('div');
      const title = document.createElement('h3');
      title.className = 'card-title';
      title.textContent = 'Students Management';
      const subtitle = document.createElement('div');
      subtitle.className = 'card-subtitle';
      subtitle.textContent = `${State.currentSchool?.name || 'School'} • Total: ${data.total ?? 0} registered students`;
      left.appendChild(title); left.appendChild(subtitle);
      const right = document.createElement('div');
      right.style.display = 'flex';
      right.style.gap = '10px';
      const registerBtn = createActionButton('', { className: 'btn btn-emerald', onclick: () => App.openNewStudentModal() });
      const registerPlus = document.createElement('span');
      registerPlus.textContent = '+';
      registerBtn.append(registerPlus, createTextNodeSafe(' Register Student'));
      right.appendChild(registerBtn);
      header.appendChild(left); header.appendChild(right);

      const toolbar = document.createElement('div');
      toolbar.style.padding = '16px 24px'; toolbar.style.background = 'var(--slate-50)'; toolbar.style.borderBottom = '1px solid var(--slate-200)'; toolbar.style.display = 'flex'; toolbar.style.gap = '12px'; toolbar.style.flexWrap = 'wrap';
      const searchInput = document.createElement('input');
      searchInput.type = 'text'; searchInput.id = 'student-search-input'; searchInput.className = 'form-control'; searchInput.placeholder = '🔍 Search student name or registration number...'; searchInput.style.maxWidth = '320px'; searchInput.oninput = (e) => App.filterStudentsTable(e.target.value);
      const formSelect = document.createElement('select');
      formSelect.className = 'form-control'; formSelect.style.maxWidth = '160px'; formSelect.onchange = (e) => App.filterStudentsByForm(e.target.value);
      const blank = document.createElement('option'); blank.value = ''; blank.textContent = 'All Forms'; formSelect.appendChild(blank);
      const classList = (await API.getClasses(State.currentSchool?.id)).classes || [];
      classList.forEach(c => { const opt = document.createElement('option'); opt.value = c.name; opt.textContent = c.name; formSelect.appendChild(opt); });

      const tableWrap = document.createElement('div');
      tableWrap.className = 'table-responsive';
      const table = document.createElement('table');
      table.className = 'data-table'; table.id = 'students-table';
      const thead = document.createElement('thead');
      const trHead = document.createElement('tr');
      ['Reg Number','Student Name','Sex','Form & Stream','Parent / Guardian','Status','Actions'].forEach(label => { const th = document.createElement('th'); th.textContent = label; if (label === 'Actions') th.style.textAlign = 'right'; trHead.appendChild(th); });
      thead.appendChild(trHead);
      const tbody = document.createElement('tbody');
      students.forEach(s => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-form', s.class_name || '');
        tr.setAttribute('data-search', `${s.first_name || ''} ${s.last_name || ''} ${s.reg_number || ''}`.trim());
        const regTd = document.createElement('td'); const regStrong = document.createElement('strong'); regStrong.textContent = s.reg_number || ''; regTd.appendChild(regStrong);
        const nameTd = document.createElement('td'); const nameStrong = document.createElement('strong'); const fullName = `${s.first_name || ''} ${s.middle_name ? `${s.middle_name} ` : ''}${s.last_name || ''}`.trim(); nameStrong.textContent = fullName; nameTd.appendChild(nameStrong);
        const sexTd = document.createElement('td'); const sexBadge = createBadge(s.gender || '', s.gender === 'M' ? 'badge-male' : 'badge-female'); sexTd.appendChild(sexBadge);
        const formTd = document.createElement('td'); const classBadge = createBadge(s.class_name || '', '', { background: 'var(--slate-100)', color: 'var(--slate-800)', fontWeight: '700' }); const streamBadge = createBadge(s.stream_name || 'No Stream', '', { background: '#e0e7ff', color: '#3730a3', fontWeight: '700', marginLeft: '4px' }); formTd.appendChild(classBadge); formTd.appendChild(streamBadge);
        const parentTd = document.createElement('td');
        const parentSmall = document.createElement('small');
        const parentName = s.parent_name || 'Guardian';
        const parentPhone = s.parent_phone || '-';
        parentSmall.appendChild(createTextNodeSafe(parentName));
        parentSmall.appendChild(document.createElement('br'));
        parentSmall.appendChild(createTextNodeSafe(parentPhone));
        parentTd.appendChild(parentSmall);
        const statusTd = document.createElement('td'); statusTd.appendChild(createBadge(s.status || '', 'badge-success'));
        const actionsTd = document.createElement('td'); actionsTd.style.textAlign = 'right';
        const actionsWrap = document.createElement('div'); actionsWrap.style.display = 'inline-flex'; actionsWrap.style.gap = '6px';
        const editBtn = createActionButton('✏️ Edit', { className: 'btn btn-secondary btn-sm', onclick: () => App.openEditStudentModal(s.id), title: 'Edit Form & Stream Allocation' });
        const dossierBtn = createActionButton('Dossier', { className: 'btn btn-secondary btn-sm', onclick: () => App.viewStudentProfile(s.id) });
        actionsWrap.appendChild(editBtn); actionsWrap.appendChild(dossierBtn); actionsTd.appendChild(actionsWrap);
        tr.append(regTd, nameTd, sexTd, formTd, parentTd, statusTd, actionsTd);
        tbody.appendChild(tr);
      });
      table.appendChild(thead); table.appendChild(tbody); tableWrap.appendChild(table); card.appendChild(header); card.appendChild(toolbar); card.appendChild(tableWrap); container.replaceChildren(card);
    } catch (err) {
      container.replaceChildren(createErrorState(`Failed to load students: ${err.message}`));
    }
  },


  filterStudentsTable(searchTerm) {
    const term = searchTerm.toLowerCase();
    document.querySelectorAll('#students-table tbody tr').forEach(row => {
      const data = (row.getAttribute('data-search') || '').toLowerCase();
      row.style.display = data.includes(term) ? '' : 'none';
    });
  },

  filterStudentsByForm(formName) {
    document.querySelectorAll('#students-table tbody tr').forEach(row => {
      const form = row.getAttribute('data-form') || '';
      row.style.display = (!formName || form === formName) ? '' : 'none';
    });
  },

  /* =====================================================================
     3. TEACHERS VIEW
     ===================================================================== */
  async renderTeachers(container) {
    container.replaceChildren(createLoadingState('Loading Faculty & Teaching Staff...'));

    try {
      const data = await API.getTeachers(State.currentSchool?.id);
      const teachers = data.teachers || [];
      State.teachersCount = teachers.length;

      const card = document.createElement('div');
      card.className = 'card';
      const header = document.createElement('div');
      header.className = 'card-header';
      const titleWrap = document.createElement('div');
      const title = document.createElement('h3');
      title.className = 'card-title';
      title.textContent = 'Teaching Staff & Faculty Directory';
      const subtitle = document.createElement('div');
      subtitle.className = 'card-subtitle';
      subtitle.textContent = `${State.currentSchool?.name || 'School'} • Total: ${teachers.length} registered teachers`;
      titleWrap.appendChild(title); titleWrap.appendChild(subtitle);
      const addBtn = createActionButton('', { className: 'btn btn-emerald', onclick: () => App.openNewTeacherModal() });
      const addPlus = document.createElement('span');
      addPlus.textContent = '+';
      const addText = createTextNodeSafe(' Add Teacher');
      addBtn.append(addPlus, addText);
      header.appendChild(titleWrap); header.appendChild(addBtn);
      const tableWrap = document.createElement('div');
      tableWrap.className = 'table-responsive';
      const table = document.createElement('table');
      table.className = 'data-table';
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      ['S/N', 'FULL NAME', 'GENDER', 'TEACHING SUBJECT', 'CLASSES ASSIGNED', 'PHONE NUMBER', 'USERNAME', 'ACTIONS'].forEach((label, idx) => {
        const th = document.createElement('th');
        th.textContent = label;
        if (idx === 0) th.style.width = '50px';
        if (label === 'ACTIONS') th.style.textAlign = 'right';
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      const tbody = document.createElement('tbody');
      if (teachers.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 8; cell.style.textAlign = 'center'; cell.style.padding = '32px'; cell.style.color = 'var(--slate-500)'; cell.textContent = 'No teachers registered yet. Click + Add Teacher to register the first teacher.';
        row.appendChild(cell); tbody.appendChild(row);
      } else {
        teachers.forEach((t, index) => {
          const row = document.createElement('tr');
          const sn = document.createElement('td');
          const snStrong = createStrongText(`#${t.sn ?? index + 1}`);
          sn.appendChild(snStrong);
          const fullName = document.createElement('td');
          const fullNameStrong = document.createElement('strong'); fullNameStrong.style.color = 'var(--slate-900)'; fullNameStrong.style.fontSize = '0.95rem'; fullNameStrong.textContent = `Mwl. ${t.fullName || `${t.first_name || ''} ${t.last_name || ''}`.trim() || 'Unknown teacher'}`; fullName.appendChild(fullNameStrong);
          const gender = document.createElement('td');
          const genderBadge = createBadge(t.gender === 'M' ? 'Male' : 'Female', t.gender === 'M' ? 'badge-male' : 'badge-female'); gender.appendChild(genderBadge);
          const subjectCell = document.createElement('td'); const subjectWrap = document.createElement('div'); subjectWrap.style.display = 'flex'; subjectWrap.style.gap = '4px'; subjectWrap.style.flexWrap = 'wrap';
          if (t.subjects && t.subjects.length > 0) {
            t.subjects.forEach(s => { const badge = createBadge(s.code || s.name || 'Subject'); badge.style.background = 'var(--slate-100)'; badge.style.color = 'var(--slate-800)'; badge.style.fontWeight = '700'; subjectWrap.appendChild(badge); });
          } else {
            const empty = document.createElement('span'); empty.style.color = 'var(--slate-400)'; empty.style.fontSize = '0.78rem'; empty.style.fontStyle = 'italic'; empty.textContent = 'None assigned'; subjectWrap.appendChild(empty);
          }
          subjectCell.appendChild(subjectWrap);
          const classCell = document.createElement('td'); const classWrap = document.createElement('div'); classWrap.style.display = 'flex'; classWrap.style.gap = '4px'; classWrap.style.flexWrap = 'wrap';
          if (t.assignedClasses && t.assignedClasses.length > 0) {
            t.assignedClasses.forEach(c => { const badge = createBadge(c.label || 'Class'); badge.style.background = '#e0e7ff'; badge.style.color = '#3730a3'; badge.style.fontWeight = '700'; classWrap.appendChild(badge); });
          } else {
            const empty = document.createElement('span'); empty.style.color = 'var(--slate-400)'; empty.style.fontSize = '0.78rem'; empty.style.fontStyle = 'italic'; empty.textContent = 'None assigned'; classWrap.appendChild(empty);
          }
          classCell.appendChild(classWrap);
          const phoneCell = document.createElement('td'); if (t.phone) { const span = document.createElement('span'); span.style.fontWeight = '600'; span.style.color = 'var(--slate-700)'; span.textContent = t.phone; phoneCell.appendChild(span); } else { const span = document.createElement('span'); span.style.color = 'var(--slate-400)'; span.textContent = '-'; phoneCell.appendChild(span); }
          const usernameCell = document.createElement('td'); const code = document.createElement('code'); code.style.fontWeight = '700'; code.style.color = 'var(--primary-700)'; code.style.background = 'var(--primary-50)'; code.style.padding = '3px 8px'; code.style.borderRadius = '4px'; code.style.border = '1px solid var(--primary-100)'; code.style.letterSpacing = '0.04em'; code.textContent = t.username || '-'; usernameCell.appendChild(code);
          const actionsCell = document.createElement('td'); actionsCell.style.textAlign = 'right'; const actionsWrap = document.createElement('div'); actionsWrap.style.display = 'inline-flex'; actionsWrap.style.gap = '6px'; const editBtn = createActionButton('✏️ Edit', { className: 'btn btn-secondary btn-sm', onclick: () => App.openEditTeacherModal(t.id), title: 'Edit Teacher Record & Allocations' }); const deleteBtn = createActionButton('🗑️', { className: 'btn btn-secondary btn-sm', onclick: () => App.handleDeleteTeacher(t.id, `${t.first_name || ''} ${t.last_name || ''}`.trim()), title: 'Delete Teacher', style: { color: 'var(--danger)', borderColor: '#fecaca' } }); actionsWrap.appendChild(editBtn); actionsWrap.appendChild(deleteBtn); actionsCell.appendChild(actionsWrap);
          row.append(sn, fullName, gender, subjectCell, classCell, phoneCell, usernameCell, actionsCell); tbody.appendChild(row);
        });
      }
      table.appendChild(thead); table.appendChild(tbody); tableWrap.appendChild(table); card.appendChild(header); card.appendChild(tableWrap); container.replaceChildren(card);
    } catch (err) {
      container.replaceChildren(createErrorState(`Failed to load teachers: ${err.message}`));
    }
  },


  /* =====================================================================
     4. ACADEMICS VIEW
     ===================================================================== */
  async renderAcademics(container) {
    container.replaceChildren(createLoadingState('Loading Academic Structures...'));

    try {
      const [classesData, subjectsData] = await Promise.all([
        API.getClasses(State.currentSchool?.id),
        API.getSubjects(State.currentSchool?.id)
      ]);

      const classes = classesData.classes || [];
      const subjects = subjectsData.subjects || [];

      const root = document.createElement('div');
      root.className = 'analytics-two-col';

      const classesCard = document.createElement('div');
      classesCard.className = 'card';
      const classesHeader = document.createElement('div');
      classesHeader.className = 'card-header';
      const classesTitle = document.createElement('h3');
      classesTitle.className = 'card-title';
      classesTitle.textContent = 'Classes & Streams (Forms 1–4)';
      classesHeader.appendChild(classesTitle);
      const classesBody = document.createElement('div');
      classesBody.className = 'card-body';
      const classesWrap = document.createElement('div');
      classesWrap.style.display = 'flex';
      classesWrap.style.flexDirection = 'column';
      classesWrap.style.gap = '16px';
      classes.forEach(c => {
        const block = document.createElement('div');
        block.style.background = 'var(--slate-50)';
        block.style.border = '1px solid var(--slate-200)';
        block.style.borderRadius = 'var(--radius-md)';
        block.style.padding = '14px';
        const row = document.createElement('div');
        row.style.display = 'flex'; row.style.justifyContent = 'space-between'; row.style.alignItems = 'center'; row.style.marginBottom = '8px';
        const strong = document.createElement('strong'); strong.style.fontSize = '1rem'; strong.style.color = 'var(--slate-900)'; strong.textContent = c.name || '';
        const rightSide = document.createElement('div'); rightSide.style.display = 'flex'; rightSide.style.gap = '8px'; rightSide.style.alignItems = 'center';
        rightSide.appendChild(createBadge(`${c.total_students ?? 0} Students`, 'badge-success'));
        const addBtn = createActionButton('+ Add Stream', { className: 'btn btn-secondary btn-sm', onclick: () => App.promptAddStream(c.id, c.name || ''), title: 'Configure new stream' });
        rightSide.appendChild(addBtn);
        row.appendChild(strong); row.appendChild(rightSide); block.appendChild(row);
        const streamWrap = document.createElement('div'); streamWrap.style.display = 'flex'; streamWrap.style.gap = '8px'; streamWrap.style.flexWrap = 'wrap';
        (c.streams || []).forEach(st => {
          const badge = createBadge(`${st.name || ''} (${st.total_students ?? 0} Enrolled)`, '', { background: '#ffffff', border: '1px solid var(--slate-300)', fontSize: '0.75rem' });
          streamWrap.appendChild(badge);
        });
        block.appendChild(streamWrap); classesWrap.appendChild(block);
      });
      classesBody.appendChild(classesWrap); classesCard.appendChild(classesHeader); classesCard.appendChild(classesBody);

      const subjectsCard = document.createElement('div');
      subjectsCard.className = 'card';
      const subjectsHeader = document.createElement('div');
      subjectsHeader.className = 'card-header';
      const subjTitle = document.createElement('h3');
      subjTitle.className = 'card-title'; subjTitle.textContent = 'Tanzanian CSEE Subjects';
      subjectsHeader.appendChild(subjTitle);
      const subjBody = document.createElement('div'); subjBody.className = 'card-body'; subjBody.style.padding = '0';
      const table = document.createElement('table'); table.className = 'data-table';
      const thead = document.createElement('thead');
      const tr = document.createElement('tr');
      ['Code', 'Subject Title', 'Classification'].forEach(label => { const th = document.createElement('th'); th.textContent = label; tr.appendChild(th); });
      thead.appendChild(tr); table.appendChild(thead);
      const tbody = document.createElement('tbody');
      subjects.forEach(sub => {
        const row = document.createElement('tr');
        const codeTd = document.createElement('td'); const codeBadge = document.createElement('span'); codeBadge.className = 'sub-code-badge'; codeBadge.textContent = sub.code || ''; codeTd.appendChild(codeBadge);
        const nameTd = document.createElement('td'); const nameStrong = document.createElement('strong'); nameStrong.textContent = sub.name || ''; nameTd.appendChild(nameStrong);
        const catTd = document.createElement('td');
        const badge = createBadge(sub.is_core ? 'Core Compulsory' : 'Elective', sub.is_core ? 'badge-success' : '', sub.is_core ? null : { background: 'var(--slate-100)' });
        catTd.appendChild(badge);
        row.append(codeTd, nameTd, catTd); tbody.appendChild(row);
      });
      table.appendChild(tbody); subjBody.appendChild(table); subjectsCard.appendChild(subjectsHeader); subjectsCard.appendChild(subjBody);
      root.append(classesCard, subjectsCard); container.replaceChildren(root);
    } catch (err) {
      container.replaceChildren(createErrorState(`Failed to load academics: ${err.message}`));
    }
  },


  /* =====================================================================
     5. EXAMINATIONS VIEW
     ===================================================================== */
  async renderExams(container) {
    container.replaceChildren(createLoadingState('Loading Examinations...'));

    try {
      const data = await API.getExams({ school_id: State.currentSchool?.id });
      const exams = data.exams || [];

      const card = document.createElement('div');
      card.className = 'card';
      const header = document.createElement('div');
      header.className = 'card-header';
      const left = document.createElement('div');
      const title = document.createElement('h3'); title.className = 'card-title'; title.textContent = 'Examinations & Mark Registers';
      const subtitle = document.createElement('div'); subtitle.className = 'card-subtitle'; subtitle.textContent = 'Manage examination sessions, security locking and NECTA results processing';
      left.append(title, subtitle);
      const createBtn = createActionButton('', { className: 'btn btn-primary', onclick: () => App.openNewExamModal() });
      const createPlus = document.createElement('span');
      createPlus.textContent = '+';
      createBtn.append(createPlus, createTextNodeSafe(' Create Examination'));
      header.append(left, createBtn);
      const tableWrap = document.createElement('div'); tableWrap.className = 'table-responsive';
      const table = document.createElement('table'); table.className = 'data-table';
      const thead = document.createElement('thead'); const trHead = document.createElement('tr');
      ['Examination Name', 'Class', 'Term / Year', 'Grading System', 'Lock Status', 'Processed', 'Operations'].forEach((label) => { const th = document.createElement('th'); th.textContent = label; if (label === 'Operations') th.style.textAlign = 'right'; trHead.appendChild(th); });
      thead.appendChild(trHead); table.appendChild(thead);
      const tbody = document.createElement('tbody');
      exams.forEach((e) => {
        const tr = document.createElement('tr');
        const nameTd = document.createElement('td');
        const nameStrong = document.createElement('strong'); nameStrong.style.color = 'var(--primary-700)'; nameStrong.style.fontSize = '0.95rem'; nameStrong.textContent = e.name || '';
        const small = document.createElement('small'); small.style.color = 'var(--slate-500)'; small.textContent = `${e.exam_type || ''} Examination`;
        nameTd.append(nameStrong, document.createElement('br'), small);
        const classTd = document.createElement('td'); const classStrong = document.createElement('strong'); classStrong.textContent = e.class_name || ''; classTd.appendChild(classStrong);
        const termTd = document.createElement('td'); termTd.textContent = `${e.term_name || ''} • ${e.year_label || ''}`;
        const gradeTd = document.createElement('td'); const gradeBadge = createBadge(e.grading_system_name || 'NECTA Standard', '', { background: 'var(--primary-50)', color: 'var(--primary-700)' }); gradeTd.appendChild(gradeBadge);
        const lockTd = document.createElement('td'); lockTd.appendChild(createBadge(e.is_locked ? '🔒 Locked' : '🔓 Entry Open', e.is_locked ? 'badge-locked' : 'badge-unlocked'));
        const processedTd = document.createElement('td');
        const processedBadge = e.processed_count > 0 ? createBadge(`✓ Processed (${e.processed_count})`, 'badge-success') : createBadge('Pending', '', { background: 'var(--slate-100)' });
        processedTd.appendChild(processedBadge);
        const opsTd = document.createElement('td'); opsTd.style.textAlign = 'right';
        const wrap = document.createElement('div'); wrap.style.display = 'inline-flex'; wrap.style.gap = '6px';
        wrap.appendChild(createActionButton('✍️ Enter Marks', { className: 'btn btn-secondary btn-sm', onclick: () => App.openMarksForExam(e.id) }));
        wrap.appendChild(createActionButton('⚡ Process NECTA', { className: 'btn btn-emerald btn-sm', onclick: () => App.processExamResults(e.id) }));
        wrap.appendChild(createActionButton('📑 Broadsheet', { className: 'btn btn-secondary btn-sm', onclick: () => App.viewBroadsheetForExam(e.id) }));
        wrap.appendChild(createActionButton(e.is_locked ? '🔓 Unlock' : '🔒 Lock', { className: 'btn btn-secondary btn-sm', onclick: () => App.toggleExamLock(e.id, e.is_locked ? 0 : 1), title: e.is_locked ? 'Unlock Examination' : 'Lock Examination' }));
        opsTd.appendChild(wrap); tr.append(nameTd, classTd, termTd, gradeTd, lockTd, processedTd, opsTd); tbody.appendChild(tr);
      });
      table.appendChild(tbody); tableWrap.appendChild(table); card.append(header, tableWrap); container.replaceChildren(card);
    } catch (err) {
      container.replaceChildren(createErrorState(`Failed to load examinations: ${err.message}`));
    }
  },


  async toggleExamLock(examId, lockState) {
    try {
      await API.toggleExamLock(examId, lockState, State.currentSchool?.id);
      this.showToast(lockState ? 'Examination locked. Marks entry closed.' : 'Examination unlocked for marks entry.', 'info');
      this.render();
    } catch (err) {
      this.showToast(`Error: ${err.message}`, 'danger');
    }
  },

  async processExamResults(examId) {
    this.showToast('Computing NECTA Best-7 Points, Divisions & Ranks...', 'info');
    try {
      const res = await API.processExam(examId, State.currentSchool?.id);
      if (res.success) {
        this.showToast(`Processed results for ${res.totalStudents} candidates.`, 'success');
        this.render();
      }
    } catch (err) {
      this.showToast(`Results processing failed: ${err.message}`, 'danger');
    }
  },

  /* =====================================================================
     6. MARKS ENTRY VIEW
     ===================================================================== */
  async renderMarks(container, targetExamId = null, targetSubjectId = null) {
    const loading = createLoadingState('Loading Marks Register Sheet...');
    container.replaceChildren(loading);

    try {
      const [examsData, subjectsData] = await Promise.all([
        API.getExams({ school_id: State.currentSchool?.id }),
        API.getSubjects(State.currentSchool?.id)
      ]);

      const exams = examsData.exams || [];
      const subjects = subjectsData.subjects || [];
      const activeExamId = targetExamId || exams[0]?.id;
      const activeSubjectId = targetSubjectId || subjects[0]?.id;

      if (!activeExamId || !activeSubjectId) {
        const empty = document.createElement('div');
        empty.className = 'card';
        empty.style.padding = '24px';
        empty.textContent = 'Please create an examination and subjects first.';
        container.replaceChildren(empty);
        return;
      }

      const sheet = await API.getMarksSheet(activeExamId, activeSubjectId);
      const card = document.createElement('div');
      card.className = 'card';

      const header = document.createElement('div');
      header.className = 'card-header';
      const left = document.createElement('div');
      const title = document.createElement('h3');
      title.className = 'card-title';
      title.textContent = 'Subject Marks Entry Register';
      const subtitle = document.createElement('div');
      subtitle.className = 'card-subtitle';
      subtitle.appendChild(document.createTextNode(`${sheet.exam.name || ''} • Class: `));
      subtitle.appendChild(createStrongText(String(sheet.exam.class_name || '')));
      subtitle.appendChild(document.createTextNode(' • Subject: '));
      subtitle.appendChild(createStrongText(`${sheet.subject.name || ''} (${sheet.subject.code || ''})`));
      left.append(title, subtitle);
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'btn btn-emerald';
      saveBtn.textContent = '💾 Save Marks';
      saveBtn.onclick = () => App.saveCurrentMarks(activeExamId, activeSubjectId);
      header.append(left, saveBtn);

      const selectorBar = document.createElement('div');
      selectorBar.style.padding = '16px 24px';
      selectorBar.style.background = 'var(--slate-50)';
      selectorBar.style.borderBottom = '1px solid var(--slate-200)';
      selectorBar.style.display = 'flex';
      selectorBar.style.gap = '16px';
      selectorBar.style.flexWrap = 'wrap';
      selectorBar.style.alignItems = 'center';

      const examWrap = document.createElement('div');
      examWrap.style.display = 'flex';
      examWrap.style.alignItems = 'center';
      examWrap.style.gap = '8px';
      const examLabel = document.createElement('label');
      examLabel.className = 'form-label';
      examLabel.style.margin = '0';
      examLabel.textContent = 'Exam:';
      const examSelect = document.createElement('select');
      examSelect.className = 'form-control';
      examSelect.style.width = 'auto';
      examSelect.onchange = () => App.renderMarks(document.getElementById('content-area'), examSelect.value, activeSubjectId);
      exams.forEach((e) => { const option = document.createElement('option'); option.value = String(e.id); option.textContent = e.name || ''; option.selected = Number(e.id) === Number(activeExamId); examSelect.appendChild(option); });
      examWrap.append(examLabel, examSelect);

      const subjectWrap = document.createElement('div');
      subjectWrap.style.display = 'flex';
      subjectWrap.style.alignItems = 'center';
      subjectWrap.style.gap = '8px';
      const subjectLabel = document.createElement('label');
      subjectLabel.className = 'form-label';
      subjectLabel.style.margin = '0';
      subjectLabel.textContent = 'Subject:';
      const subjectSelect = document.createElement('select');
      subjectSelect.className = 'form-control';
      subjectSelect.style.width = 'auto';
      subjectSelect.onchange = () => App.renderMarks(document.getElementById('content-area'), activeExamId, subjectSelect.value);
      subjects.forEach((s) => { const option = document.createElement('option'); option.value = String(s.id); option.textContent = `${s.code || ''} - ${s.name || ''}`; option.selected = Number(s.id) === Number(activeSubjectId); subjectSelect.appendChild(option); });
      subjectWrap.append(subjectLabel, subjectSelect);
      selectorBar.append(examWrap, subjectWrap);
      if (sheet.exam.is_locked) {
        const lockBadge = document.createElement('span');
        lockBadge.className = 'badge badge-locked';
        lockBadge.textContent = '🔒 LOCKED: Academic Master has locked this exam. Marks are read-only.';
        selectorBar.appendChild(lockBadge);
      }

      const tableWrap = document.createElement('div');
      tableWrap.className = 'table-responsive';
      const table = document.createElement('table');
      table.className = 'data-table';
      table.id = 'marks-entry-table';
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      ['#', 'Reg Number', 'Student Name', 'Sex', 'Stream', 'Score (0–100)', 'Grade', 'Points', 'Absent?'].forEach((label, idx) => {
        const th = document.createElement('th');
        th.textContent = label;
        if (idx === 0) th.style.width = '50px';
        if (idx >= 5 && idx <= 7) { th.style.textAlign = 'center'; }
        if (idx === 5) th.style.width = '120px';
        if (idx === 6 || idx === 7) th.style.width = '80px';
        headRow.appendChild(th);
      });
      thead.appendChild(headRow); table.appendChild(thead);
      const tbody = document.createElement('tbody');
      (sheet.students || []).forEach((st, idx) => {
        const row = document.createElement('tr');
        row.setAttribute('data-student-id', String(st.student_id));

        const numTd = document.createElement('td');
        numTd.textContent = String(idx + 1);

        const regTd = document.createElement('td');
        const regStrong = createStrongText(String(st.reg_number || ''));
        regTd.appendChild(regStrong);

        const nameTd = document.createElement('td');
        const nameStrong = createStrongText(`${st.first_name || ''} ${st.last_name || ''}`.trim() || '');
        nameTd.appendChild(nameStrong);

        const sexTd = document.createElement('td');
        sexTd.appendChild(createBadge(st.gender || '', st.gender === 'M' ? 'badge-male' : 'badge-female'));

        const streamTd = document.createElement('td');
        streamTd.textContent = st.stream_name || 'Stream A';

        const scoreTd = document.createElement('td');
        scoreTd.style.textAlign = 'center';
        const scoreInput = document.createElement('input');
        scoreInput.type = 'number';
        scoreInput.min = '0';
        scoreInput.max = '100';
        scoreInput.step = '0.5';
        scoreInput.className = 'marks-input mark-score-input';
        scoreInput.value = st.marks !== null && st.marks !== undefined ? String(st.marks) : '';
        if (sheet.exam.is_locked) scoreInput.disabled = true;
        scoreInput.oninput = (e) => App.handleMarkInputChange(e.target);
        scoreTd.appendChild(scoreInput);

        const gradeTd = document.createElement('td');
        gradeTd.className = 'grade-badge-cell mark-grade-cell';
        gradeTd.appendChild(createBadge(st.grade || '-', ''));

        const pointsTd = document.createElement('td');
        pointsTd.className = 'mark-point-cell';
        pointsTd.style.textAlign = 'center';
        const pointsStrong = document.createElement('strong');
        pointsStrong.textContent = st.points || '-';
        pointsTd.appendChild(pointsStrong);

        const absentTd = document.createElement('td');
        absentTd.style.textAlign = 'center';
        const absentChk = document.createElement('input');
        absentChk.type = 'checkbox';
        absentChk.className = 'mark-absent-chk';
        absentChk.checked = !!st.is_absent;
        if (sheet.exam.is_locked) absentChk.disabled = true;
        absentChk.onchange = (e) => App.handleAbsentToggle(e.target);
        absentTd.appendChild(absentChk);

        row.append(numTd, regTd, nameTd, sexTd, streamTd, scoreTd, gradeTd, pointsTd, absentTd);
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      tableWrap.appendChild(table);
      card.append(header, selectorBar, tableWrap);
      container.replaceChildren(card);
    } catch (err) {
      const error = createErrorState(`Failed to load marks entry: ${err.message}`);
      container.replaceChildren(error);
    }
  },

  handleMarkInputChange(input) {
    const row = input.closest('tr');
    const val = input.value;
    const gradeCell = row.querySelector('.mark-grade-cell');
    const pointCell = row.querySelector('.mark-point-cell');

    if (val === '' || Number.isNaN(Number(val))) {
      const emptyBadge = document.createElement('span');
      emptyBadge.className = 'badge';
      emptyBadge.textContent = '-';
      gradeCell.replaceChildren(emptyBadge);
      pointCell.textContent = '-';
      return;
    }

    const num = Number(val);
    let grade = 'F';
    let pts = 5;
    if (num >= 75) { grade = 'A'; pts = 1; }
    else if (num >= 65) { grade = 'B'; pts = 2; }
    else if (num >= 45) { grade = 'C'; pts = 3; }
    else if (num >= 30) { grade = 'D'; pts = 4; }

    const badge = document.createElement('span');
    badge.className = 'badge badge-success';
    badge.textContent = grade;
    gradeCell.replaceChildren(badge);

    const strong = document.createElement('strong');
    strong.textContent = String(pts);
    pointCell.replaceChildren(strong);
  },

  handleAbsentToggle(chk) {
    const row = chk.closest('tr');
    const scoreInput = row.querySelector('.mark-score-input');
    if (chk.checked) {
      scoreInput.value = '';
      scoreInput.disabled = true;
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'ABS';
      row.querySelector('.mark-grade-cell').replaceChildren(badge);
      row.querySelector('.mark-point-cell').textContent = '-';
    } else {
      scoreInput.disabled = false;
    }
  },


  async saveCurrentMarks(examId, subjectId) {
    const rows = document.querySelectorAll('#marks-entry-table tbody tr');
    const marksData = [];

    rows.forEach(row => {
      const studentId = parseInt(row.getAttribute('data-student-id'), 10);
      const isAbsent = row.querySelector('.mark-absent-chk')?.checked || false;
      const scoreVal = row.querySelector('.mark-score-input')?.value;

      marksData.push({
        studentId,
        marks: (scoreVal !== '' && !isAbsent) ? parseFloat(scoreVal) : null,
        isAbsent
      });
    });

    try {
      this.showToast('Saving marks to database...', 'info');
      await API.saveMarks(examId, subjectId, marksData, State.currentSchool?.id);
      this.showToast('Marks successfully saved!', 'success');
    } catch (err) {
      this.showToast(`Error saving marks: ${err.message}`, 'danger');
    }
  },

  openMarksForExam(examId) {
    State.setView('marks');
    this.renderMarks(document.getElementById('content-area'), examId);
  },

  /* =====================================================================
     7. BROADSHEET & RESULTS VIEW
     ===================================================================== */
  async renderBroadsheet(container, targetExamId = null) {
    const loading = createLoadingState('Compiling Official NECTA Broadsheet...');
    container.replaceChildren(loading);

    try {
      const examsData = await API.getExams({ school_id: State.currentSchool?.id });
      const exams = examsData.exams || [];
      const activeExamId = targetExamId || exams[0]?.id;

      if (!activeExamId) {
        const empty = document.createElement('div');
        empty.className = 'card';
        empty.style.padding = '24px';
        empty.textContent = 'No examinations found.';
        container.replaceChildren(empty);
        return;
      }

      const broadsheet = await API.getBroadsheet(activeExamId, State.currentSchool?.id);
      const subjects = broadsheet.subjects || [];
      const rows = broadsheet.rows || [];

      const card = document.createElement('div');
      card.className = 'card';
      const header = document.createElement('div');
      header.className = 'card-header';
      const left = document.createElement('div');
      const title = document.createElement('h3');
      title.className = 'card-title';
      title.textContent = 'Official Examination Broadsheet (NECTA CSEE)';
      const subtitle = document.createElement('div');
      subtitle.className = 'card-subtitle';
      subtitle.appendChild(document.createTextNode(`${broadsheet.exam.name || ''} • Class: `));
      subtitle.appendChild(createStrongText(String(broadsheet.exam.class_name || '')));
      subtitle.appendChild(document.createTextNode(` • ${State.currentSchool?.name || ''}`));
      left.append(title, subtitle);
      const printBtn = document.createElement('button');
      printBtn.type = 'button';
      printBtn.className = 'btn btn-emerald';
      printBtn.textContent = '🖨️ Print Broadsheet';
      printBtn.onclick = () => window.print();
      header.append(left, printBtn);

      const selectorBar = document.createElement('div');
      selectorBar.style.padding = '14px 24px';
      selectorBar.style.background = 'var(--slate-50)';
      selectorBar.style.borderBottom = '1px solid var(--slate-200)';
      selectorBar.style.display = 'flex';
      selectorBar.style.gap = '12px';
      selectorBar.style.alignItems = 'center';
      const selectLabel = document.createElement('label');
      selectLabel.className = 'form-label';
      selectLabel.style.margin = '0';
      selectLabel.textContent = 'Select Examination:';
      const select = document.createElement('select');
      select.className = 'form-control';
      select.style.width = 'auto';
      select.onchange = () => App.renderBroadsheet(document.getElementById('content-area'), select.value);
      exams.forEach((e) => {
        const option = document.createElement('option');
        option.value = String(e.id);
        option.textContent = e.name || '';
        option.selected = Number(e.id) === Number(activeExamId);
        select.appendChild(option);
      });
      selectorBar.append(selectLabel, select);

      const tableWrap = document.createElement('div');
      tableWrap.className = 'table-responsive';
      const table = document.createElement('table');
      table.className = 'data-table broadsheet-table';
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      ['Rank', 'Candidate Name', 'Reg No', 'Sex', ...subjects.map(s => s.code || ''), 'Total', 'Avg', 'GPA', 'Best 7', 'Division', 'Action'].forEach((label) => {
        const th = document.createElement('th');
        th.textContent = label;
        if (label === 'Rank') th.style.width = '45px';
        if (label === 'Candidate Name') th.style.textAlign = 'left';
        headRow.appendChild(th);
      });
      thead.appendChild(headRow); table.appendChild(thead);

      const tbody = document.createElement('tbody');
      rows.forEach((r) => {
        const tr = document.createElement('tr');
        const rankTd = document.createElement('td');
        const rankStrong = document.createElement('strong');
        rankStrong.textContent = `#${r.classRank}`;
        rankTd.appendChild(rankStrong);

        const nameTd = document.createElement('td');
        nameTd.className = 'text-left';
        const nameStrong = document.createElement('strong');
        nameStrong.textContent = r.fullName || '';
        nameTd.appendChild(nameStrong);

        const regTd = document.createElement('td');
        const regSmall = document.createElement('small');
        regSmall.textContent = r.regNumber || '';
        regTd.appendChild(regSmall);

        const sexTd = document.createElement('td');
        const sexBadge = document.createElement('span');
        sexBadge.className = `badge ${r.gender === 'M' ? 'badge-male' : 'badge-female'}`;
        sexBadge.textContent = r.gender || '';
        sexTd.appendChild(sexBadge);

        tr.append(rankTd, nameTd, regTd, sexTd);
        subjects.forEach((s) => {
          const cell = document.createElement('td');
          const sub = r.subjects && r.subjects[s.code] ? r.subjects[s.code] : {};
          const val = sub.marks !== '-' ? sub.marks : '-';
          cell.appendChild(document.createTextNode(String(val)));
          const breakLine = document.createElement('br');
          cell.appendChild(breakLine);
          const small = document.createElement('small');
          small.style.fontWeight = '700';
          small.style.color = 'var(--primary-600)';
          small.textContent = sub.grade || '';
          cell.appendChild(small);
          tr.appendChild(cell);
        });

        const totalTd = document.createElement('td');
        const totalStrong = document.createElement('strong');
        totalStrong.textContent = r.totalMarks ?? '';
        totalTd.appendChild(totalStrong);
        tr.appendChild(totalTd);

        const avgTd = document.createElement('td');
        const avgStrong = document.createElement('strong');
        avgStrong.textContent = `${r.averageMarks ?? ''}%`;
        avgTd.appendChild(avgStrong);
        tr.appendChild(avgTd);

        const gpaTd = document.createElement('td');
        gpaTd.textContent = r.gpa ?? '';
        tr.appendChild(gpaTd);

        const bestTd = document.createElement('td');
        const bestStrong = document.createElement('strong');
        bestStrong.textContent = r.bestSevenPoints ?? '';
        bestTd.appendChild(bestStrong);
        tr.appendChild(bestTd);

        const divisionTd = document.createElement('td');
        const divBadge = document.createElement('span');
        divBadge.className = `badge badge-div-${r.division === '0' ? '0' : String(r.division).toLowerCase()}`;
        divBadge.textContent = `Div ${r.division ?? '0'}`;
        divisionTd.appendChild(divBadge);
        tr.appendChild(divisionTd);

        const actionTd = document.createElement('td');
        const actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className = 'btn btn-secondary btn-sm';
        actionBtn.textContent = 'Report Card';
        actionBtn.onclick = () => App.openReportCardModal(activeExamId, r.studentId);
        actionTd.appendChild(actionBtn);
        tr.appendChild(actionTd);

        tbody.appendChild(tr);
      });
      table.appendChild(tbody); tableWrap.appendChild(table); card.append(header, selectorBar, tableWrap); container.replaceChildren(card);
    } catch (err) {
      const error = createErrorState(`Failed to load broadsheet: ${err.message}`);
      container.replaceChildren(error);
    }
  },

  viewBroadsheetForExam(examId) {
    State.setView('broadsheet');
    this.renderBroadsheet(document.getElementById('content-area'), examId);
  },

  /* =====================================================================
     8. STUDENT REPORT CARD MODAL
     ===================================================================== */
  async openReportCardModal(examId, studentId) {
    const modal = document.getElementById('report-card-modal');
    const body = document.getElementById('report-card-modal-body');
    if (!modal || !body) return;

    modal.classList.add('active');
    const loading = document.createElement('div');
    loading.style.textAlign = 'center';
    loading.style.padding = '30px';
    loading.textContent = 'Loading student report card...';
    body.replaceChildren(loading);

    try {
      const card = await API.getReportCard(examId, studentId, State.currentSchool?.id);
      const student = card.student || {};
      const school = card.school || {};
      const exam = card.exam || {};
      const summary = card.summary || {};
      const marks = card.marks || [];

      const root = document.createElement('div');
      root.className = 'report-card-printable';

      const header = document.createElement('div');
      header.className = 'report-card-header';
      const schoolName = document.createElement('h2');
      Object.assign(schoolName.style, { fontSize: '1.3rem', fontWeight: '800', textTransform: 'uppercase' });
      schoolName.textContent = school.name || '';
      const address = document.createElement('div');
      Object.assign(address.style, { fontSize: '0.85rem', color: 'var(--slate-600)' });
      address.textContent = `${school.address || ''} • ${school.region || ''}, Tanzania`;
      const motto = document.createElement('div');
      Object.assign(motto.style, { fontSize: '0.82rem', fontStyle: 'italic', marginTop: '2px' });
      motto.textContent = `"${school.motto || ''}"`;
      const reportTitle = document.createElement('div');
      Object.assign(reportTitle.style, {
        marginTop: '10px',
        fontWeight: '700',
        fontSize: '1rem',
        borderTop: '1px solid var(--slate-300)',
        paddingTop: '6px'
      });
      reportTitle.textContent = 'OFFICIAL TERMINAL STUDENT PROGRESS REPORT CARD';
      const examName = document.createElement('div');
      Object.assign(examName.style, { fontSize: '0.85rem', color: 'var(--slate-700)', fontWeight: '600' });
      examName.textContent = exam.name || '';
      header.append(schoolName, address, motto, reportTitle, examName);

      const particulars = document.createElement('div');
      Object.assign(particulars.style, {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        fontSize: '0.85rem',
        marginBottom: '16px',
        background: 'var(--slate-50)',
        padding: '12px',
        borderRadius: 'var(--radius-md)'
      });
      const addParticular = (label, value) => {
        const item = document.createElement('div');
        const labelEl = document.createElement('strong');
        labelEl.textContent = `${label}:`;
        item.append(labelEl, document.createTextNode(` ${value}`));
        particulars.appendChild(item);
      };
      addParticular('Student Name', `${student.first_name || ''} ${student.middle_name ? `${student.middle_name} ` : ''}${student.last_name || ''}`.trim());
      addParticular('Registration No', student.reg_number || '');
      addParticular('Class / Stream', `${student.class_name || ''} • ${student.stream_name || 'Stream A'}`);
      addParticular('Gender', student.gender === 'M' ? 'Male (M)' : 'Female (F)');

      const table = document.createElement('table');
      table.className = 'data-table';
      table.style.marginBottom = '16px';
      const thead = document.createElement('thead');
      const headingRow = document.createElement('tr');
      ['Subject Name', 'Score', 'Grade', 'Points', 'Remarks'].forEach((label, index) => {
        const th = document.createElement('th');
        th.textContent = label;
        if (index > 0 && index < 4) th.style.textAlign = 'center';
        headingRow.appendChild(th);
      });
      thead.appendChild(headingRow);
      const tbody = document.createElement('tbody');
      marks.forEach((mark) => {
        const row = document.createElement('tr');
        const subject = document.createElement('td');
        subject.appendChild(createStrongText(`${mark.subject_name || ''} (${mark.subject_code || ''})`));
        const score = document.createElement('td');
        score.style.textAlign = 'center';
        score.appendChild(createStrongText(mark.marks !== null ? mark.marks : 'ABS'));
        const grade = document.createElement('td');
        grade.style.textAlign = 'center';
        grade.appendChild(createBadge(mark.grade || '-'));
        const points = document.createElement('td');
        points.style.textAlign = 'center';
        points.textContent = mark.points || '-';
        const remarks = document.createElement('td');
        remarks.textContent = mark.remarks || '-';
        row.append(subject, score, grade, points, remarks);
        tbody.appendChild(row);
      });
      table.append(thead, tbody);

      const summaryGrid = document.createElement('div');
      Object.assign(summaryGrid.style, {
        background: 'var(--slate-100)',
        padding: '14px',
        borderRadius: 'var(--radius-md)',
        fontSize: '0.88rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        textAlign: 'center',
        marginBottom: '24px'
      });
      const summaryItems = [
        { label: 'TOTAL MARKS', value: summary.total_marks || 0 },
        { label: 'AVERAGE SCORE', value: `${summary.average_marks || 0}%` },
        { label: 'NECTA BEST 7 POINTS', value: summary.best_seven_points || 35 },
        { label: 'NECTA DIVISION', value: `Division ${summary.division || '0'}`, badge: getDivisionBadgeClass(summary.division) },
        { label: 'CLASS RANK', value: `#${summary.class_rank || '-'} / ${card.totalClassStudents || '-'}` },
        { label: 'CUMULATIVE GPA', value: summary.gpa || '-' }
      ];
      summaryItems.forEach((item) => {
        const wrapper = document.createElement('div');
        const label = document.createElement('div');
        Object.assign(label.style, { color: 'var(--slate-500)', fontSize: '0.75rem' });
        label.textContent = item.label;
        wrapper.appendChild(label);
        if (item.badge) {
          wrapper.appendChild(createBadge(item.value, item.badge, { fontSize: '0.9rem', padding: '4px 12px' }));
        } else {
          const value = createStrongText(item.value);
          value.style.fontSize = '1.15rem';
          wrapper.appendChild(value);
        }
        summaryGrid.appendChild(wrapper);
      });

      const signatures = document.createElement('div');
      signatures.className = 'report-signature-grid';
      ['Class Teacher\'s Signature', 'Headmaster / Academic Master\'s Stamp'].forEach((text) => {
        const signature = document.createElement('div');
        signature.className = 'signature-line';
        signature.textContent = text;
        signatures.appendChild(signature);
      });
      root.append(header, particulars, table, summaryGrid, signatures);
      body.replaceChildren(root);
    } catch (err) {
      const error = document.createElement('div');
      Object.assign(error.style, { color: 'var(--danger)', padding: '20px' });
      error.textContent = `Failed to load report card: ${err.message}`;
      body.replaceChildren(error);
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  },

  /* =====================================================================
     9. CLASS & STREAM DYNAMIC SELECTION HELPERS
     ===================================================================== */
  async loadClassesAndStreams(schoolId = null) {
    const sId = schoolId || State.currentSchool?.id || 1;
    const res = await API.getClasses(sId);
    State.classes = res.classes || [];
    return State.classes;
  },

  populateClassDropdown(selectEl, selectedClassId = null) {
    if (!selectEl) return;
    const classes = State.classes || [];
    selectEl.replaceChildren(
      createSafeOption('', '-- Select Form --'),
      ...classes.map(c => {
        const option = createSafeOption(c.id, c.name);
        option.selected = Number(c.id) === Number(selectedClassId);
        return option;
      })
    );
  },

  populateStreamDropdown(streamSelectEl, classId, selectedStreamId = null) {
    if (!streamSelectEl) return;
    const cId = parseInt(classId, 10);
    const classObj = (State.classes || []).find(c => c.id === cId);
    const streams = classObj ? (classObj.streams || []) : [];

    streamSelectEl.replaceChildren();
    const placeholder = createSafeOption('', streams.length === 0 ? '-- No streams available for this form --' : `-- Select Stream (${streams.length} available) --`);
    streamSelectEl.appendChild(placeholder);
    streamSelectEl.required = true;

    if (streams.length === 0) {
      return;
    }

    streams.forEach(st => {
      const option = createSafeOption(st.id, st.name);
      option.selected = Number(st.id) === Number(selectedStreamId);
      streamSelectEl.appendChild(option);
    });

    // If there is only one stream, or a stream was previously selected, auto-select
    if (selectedStreamId) {
      streamSelectEl.value = String(selectedStreamId);
    } else if (streams.length === 1) {
      streamSelectEl.value = String(streams[0].id);
    }
  },

  handleFormChangeForNewStudent(classId) {
    const streamSelect = document.getElementById('new-student-stream');
    this.populateStreamDropdown(streamSelect, classId);
  },

  handleFormChangeForEditStudent(classId) {
    const streamSelect = document.getElementById('edit-student-stream');
    this.populateStreamDropdown(streamSelect, classId);
  },

  async promptAddStream(classId, className) {
    const streamName = prompt(`Enter new Stream name for ${className} (e.g., Stream C, Stream D, Science, Commercial):`);
    if (!streamName || !streamName.trim()) return;

    try {
      this.showToast(`Configuring ${streamName.trim()} for ${className}...`, 'info');
      await API.createStream(classId, streamName.trim(), State.currentSchool?.id);
      await this.loadClassesAndStreams(State.currentSchool?.id);
      this.showToast(`Stream "${streamName.trim()}" added to ${className}!`, 'success');
      this.render();
    } catch (err) {
      this.showToast(`Failed to add stream: ${err.message}`, 'danger');
    }
  },

  /* =====================================================================
     10. NEW STUDENT REGISTRATION MODAL
     ===================================================================== */
  async openNewStudentModal() {
    const modal = document.getElementById('new-student-modal');
    if (!modal) return;

    // Ensure classes & streams are loaded for active school
    await this.loadClassesAndStreams(State.currentSchool?.id);

    const classSelect = document.getElementById('new-student-class');
    const streamSelect = document.getElementById('new-student-stream');
    const regInput = document.getElementById('new-student-reg');

    this.populateClassDropdown(classSelect);

    // Initial stream population for first class
    if (classSelect && classSelect.value) {
      this.populateStreamDropdown(streamSelect, classSelect.value);
    }

    // Suggested Registration Number
    if (regInput && (!regInput.value || regInput.value.trim() === '')) {
      const code = State.currentSchool?.code ? State.currentSchool.code.replace('TZ-', '').replace('-', '') : 'S1042';
      const seq = Math.floor(Math.random() * 800) + 100;
      regInput.value = `${code}/${seq}/2026`;
    }

    modal.classList.add('active');
  },

  async handleRegisterStudentSubmit(event) {
    event.preventDefault();
    const form = event.target;
    
    const streamId = form.streamId.value;
    if (!streamId) {
      this.showToast('Please select a valid Stream for this student.', 'warning');
      form.streamId.focus();
      return;
    }

    const studentData = {
      regNumber: form.regNumber.value.trim(),
      firstName: form.firstName.value.trim(),
      middleName: form.middleName.value.trim(),
      lastName: form.lastName.value.trim(),
      gender: form.gender.value,
      classId: parseInt(form.classId.value, 10),
      streamId: parseInt(streamId, 10),
      parentName: form.parentName.value.trim(),
      parentPhone: form.parentPhone.value.trim(),
      schoolId: State.currentSchool?.id
    };

    try {
      this.showToast('Registering student and allocating stream...', 'info');
      const res = await API.createStudent(studentData);
      this.showToast(`Student ${studentData.firstName} ${studentData.lastName} successfully registered in ${res.student?.class_name} • ${res.student?.stream_name}!`, 'success');
      this.closeModal('new-student-modal');
      form.reset();
      this.render();
    } catch (err) {
      this.showToast(`Registration failed: ${err.message}`, 'danger');
    }
  },

  /* =====================================================================
     11. EDIT STUDENT & STREAM ALLOCATION MODAL
     ===================================================================== */
  async openEditStudentModal(studentId) {
    const modal = document.getElementById('edit-student-modal');
    if (!modal) return;

    this.closeModal('student-dossier-modal');

    try {
      // Ensure classes & streams are loaded
      await this.loadClassesAndStreams(State.currentSchool?.id);

      const res = await API.getStudent(studentId);
      const student = res.student;
      if (!student) throw new Error('Student data could not be retrieved.');

      document.getElementById('edit-student-id').value = student.id;
      document.getElementById('edit-student-reg').value = student.reg_number;
      document.getElementById('edit-student-firstname').value = student.first_name;
      document.getElementById('edit-student-middlename').value = student.middle_name || '';
      document.getElementById('edit-student-lastname').value = student.last_name;
      document.getElementById('edit-student-gender').value = student.gender;
      document.getElementById('edit-student-parentname').value = student.parent_name || '';
      document.getElementById('edit-student-parentphone').value = student.parent_phone || '';
      document.getElementById('edit-student-status').value = student.status || 'ACTIVE';

      const classSelect = document.getElementById('edit-student-class');
      const streamSelect = document.getElementById('edit-student-stream');

      this.populateClassDropdown(classSelect, student.current_class_id);
      this.populateStreamDropdown(streamSelect, student.current_class_id, student.current_stream_id);

      modal.classList.add('active');
    } catch (err) {
      this.showToast(`Failed to open edit modal: ${err.message}`, 'danger');
    }
  },

  async handleUpdateStudentSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const studentId = parseInt(form.studentId.value, 10);
    const streamId = form.streamId.value;

    if (!streamId) {
      this.showToast('Please select a valid Stream for this student.', 'warning');
      form.streamId.focus();
      return;
    }

    const updateData = {
      regNumber: form.regNumber.value.trim(),
      firstName: form.firstName.value.trim(),
      middleName: form.middleName.value.trim(),
      lastName: form.lastName.value.trim(),
      gender: form.gender.value,
      classId: parseInt(form.classId.value, 10),
      streamId: parseInt(streamId, 10),
      parentName: form.parentName.value.trim(),
      parentPhone: form.parentPhone.value.trim(),
      status: form.status.value,
      schoolId: State.currentSchool?.id
    };

    try {
      this.showToast('Updating student records and stream allocation...', 'info');
      const res = await API.updateStudent(studentId, updateData);
      this.showToast(`Student updated: allocated to ${res.student?.class_name} • ${res.student?.stream_name}!`, 'success');
      this.closeModal('edit-student-modal');
      this.render();
    } catch (err) {
      this.showToast(`Update failed: ${err.message}`, 'danger');
    }
  },

  /* =====================================================================
     12. STUDENT PROFILE & DOSSIER MODAL
     ===================================================================== */
  async viewStudentProfile(studentId) {
    const modal = document.getElementById('student-dossier-modal');
    const body = document.getElementById('student-dossier-modal-body');
    const editBtn = document.getElementById('dossier-edit-btn');
    if (!modal || !body) return;

    modal.classList.add('active');
    const loading = document.createElement('div');
    Object.assign(loading.style, { textAlign: 'center', padding: '30px' });
    loading.textContent = 'Loading student dossier...';
    body.replaceChildren(loading);

    if (editBtn) {
      editBtn.onclick = () => App.openEditStudentModal(studentId);
    }

    try {
      const res = await API.getStudent(studentId);
      const student = res.student || {};
      const enrollments = student.enrollments || [];
      const examResults = student.examResults || [];

      const root = document.createElement('div');
      const header = document.createElement('div');
      Object.assign(header.style, {
        display: 'flex',
        gap: '18px',
        alignItems: 'center',
        borderBottom: '1px solid var(--slate-200)',
        paddingBottom: '16px',
        marginBottom: '16px'
      });
      const avatar = document.createElement('div');
      Object.assign(avatar.style, {
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        background: 'var(--primary-100)',
        color: 'var(--primary-700)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.5rem',
        fontWeight: '800'
      });
      avatar.textContent = student.gender === 'M' ? '👨‍🎓' : '👩‍🎓';
      const identity = document.createElement('div');
      const name = document.createElement('h3');
      Object.assign(name.style, { fontSize: '1.25rem', fontWeight: '800', color: 'var(--slate-900)' });
      name.textContent = `${student.first_name || ''} ${student.middle_name ? `${student.middle_name} ` : ''}${student.last_name || ''}`.trim();
      const details = document.createElement('div');
      Object.assign(details.style, {
        fontSize: '0.82rem',
        color: 'var(--slate-500)',
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
        marginTop: '4px'
      });
      const addDetail = (label, value) => {
        const item = document.createElement('span');
        item.append(document.createElement('strong'), document.createTextNode(` ${value}`));
        item.firstChild.textContent = `${label}:`;
        details.appendChild(item);
      };
      addDetail('Reg No', student.reg_number || '');
      addDetail('Sex', student.gender === 'M' ? 'Male' : 'Female');
      addDetail('School', student.school_name || '');
      identity.append(name, details);
      header.append(avatar, identity);

      const cards = document.createElement('div');
      Object.assign(cards.style, {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        marginBottom: '18px'
      });
      const makeInfoCard = (title, items) => {
        const card = document.createElement('div');
        Object.assign(card.style, {
          background: 'var(--slate-50)',
          padding: '12px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--slate-200)'
        });
        const heading = document.createElement('div');
        Object.assign(heading.style, {
          fontSize: '0.75rem',
          color: 'var(--slate-500)',
          textTransform: 'uppercase',
          fontWeight: '700'
        });
        heading.textContent = title;
        card.appendChild(heading);
        items.forEach((item) => {
          const line = document.createElement('div');
          Object.assign(line.style, item.style);
          line.append(document.createTextNode(item.prefix || ''), createStrongText(item.value));
          card.appendChild(line);
        });
        return card;
      };
      cards.append(
        makeInfoCard('CURRENT ALLOCATION', [
          { value: student.class_name || '', style: { fontSize: '1.1rem', fontWeight: '800', color: 'var(--slate-900)', marginTop: '2px' } },
          { prefix: 'Status: ', value: student.status || '', style: { fontSize: '0.78rem', color: 'var(--slate-500)', marginTop: '4px' } }
        ]),
        makeInfoCard('PARENT / GUARDIAN', [
          { value: student.parent_name || 'Not Provided', style: { fontSize: '0.95rem', fontWeight: '700', color: 'var(--slate-900)', marginTop: '2px' } },
          { prefix: 'Phone: ', value: student.parent_phone || 'None', style: { fontSize: '0.78rem', color: 'var(--slate-500)', marginTop: '4px' } }
        ])
      );
      const allocationLine = cards.firstElementChild.children[1];
      const className = createStrongText(student.class_name || '');
      const streamName = document.createElement('span');
      streamName.style.color = 'var(--primary-600)';
      streamName.textContent = student.stream_name || 'Stream A';
      allocationLine.replaceChildren(className, document.createTextNode(' • '), streamName);
      const statusBadge = createBadge(student.status || '', 'badge-success');
      cards.firstElementChild.children[2].replaceChildren(document.createTextNode('Status: '), statusBadge);

      const createHistoryTable = (headers, rows, rowBuilder) => {
        const table = document.createElement('table');
        table.className = 'data-table';
        table.style.fontSize = '0.8rem';
        const thead = document.createElement('thead');
        const headingRow = document.createElement('tr');
        headers.forEach((text) => {
          const th = document.createElement('th');
          th.textContent = text;
          headingRow.appendChild(th);
        });
        thead.appendChild(headingRow);
        const tbody = document.createElement('tbody');
        rows.forEach((row) => tbody.appendChild(rowBuilder(row)));
        table.append(thead, tbody);
        return table;
      };

      const enrollmentSection = document.createElement('div');
      enrollmentSection.style.marginBottom = '18px';
      const enrollmentTitle = document.createElement('h4');
      Object.assign(enrollmentTitle.style, { fontSize: '0.9rem', fontWeight: '700', color: 'var(--slate-800)', marginBottom: '8px' });
      enrollmentTitle.textContent = 'Academic Enrollment History';
      const enrollmentTable = createHistoryTable(
        ['Academic Year', 'Class / Form', 'Stream', 'Status'],
        enrollments,
        (enrollment) => {
          const row = document.createElement('tr');
          const year = document.createElement('td');
          year.appendChild(createStrongText(enrollment.year_label || ''));
          const className = document.createElement('td');
          className.textContent = enrollment.class_name || '';
          const stream = document.createElement('td');
          stream.appendChild(createBadge(enrollment.stream_name || 'Stream A', '', { background: '#e0e7ff', color: '#3730a3' }));
          const status = document.createElement('td');
          status.appendChild(createBadge(enrollment.status || '', 'badge-success'));
          row.append(year, className, stream, status);
          return row;
        }
      );
      enrollmentSection.append(enrollmentTitle, enrollmentTable);

      const resultsSection = document.createElement('div');
      const resultsTitle = document.createElement('h4');
      Object.assign(resultsTitle.style, { fontSize: '0.9rem', fontWeight: '700', color: 'var(--slate-800)', marginBottom: '8px' });
      resultsTitle.textContent = 'Examination Performance Record';
      resultsSection.appendChild(resultsTitle);
      if (examResults.length > 0) {
        resultsSection.appendChild(createHistoryTable(
          ['Examination', 'Year / Term', 'Average', 'Best 7', 'Division', 'Rank'],
          examResults,
          (result) => {
            const row = document.createElement('tr');
            const examName = document.createElement('td');
            examName.appendChild(createStrongText(result.exam_name || ''));
            const yearTerm = document.createElement('td');
            yearTerm.textContent = `${result.year_label || ''} • ${result.term_name || ''}`;
            const average = document.createElement('td');
            average.appendChild(createStrongText(`${result.average_marks ?? ''}%`));
            const bestSeven = document.createElement('td');
            bestSeven.textContent = result.best_seven_points ?? '';
            const division = document.createElement('td');
            division.appendChild(createBadge(`Div ${result.division ?? ''}`, getDivisionBadgeClass(result.division)));
            const rank = document.createElement('td');
            rank.textContent = `#${result.class_rank ?? ''}`;
            row.append(examName, yearTerm, average, bestSeven, division, rank);
            return row;
          }
        ));
      } else {
        const empty = document.createElement('div');
        Object.assign(empty.style, { fontSize: '0.8rem', color: 'var(--slate-500)', fontStyle: 'italic' });
        empty.textContent = 'No past examination records available.';
        resultsSection.appendChild(empty);
      }

      root.append(header, cards, enrollmentSection, resultsSection);
      body.replaceChildren(root);
    } catch (err) {
      const error = document.createElement('div');
      Object.assign(error.style, { color: 'var(--danger)', padding: '20px' });
      error.textContent = `Failed to load dossier: ${err.message}`;
      body.replaceChildren(error);
    }
  },

  /* =====================================================================
     13. TEACHER MODULE & REGISTRATION WORKFLOW
     ===================================================================== */
  handleTeacherNameInput(fullName, usernameInputId, isEdit = false) {
    const input = document.getElementById(usernameInputId);
    if (!input) return;

    if (!fullName || !fullName.trim()) {
      if (!isEdit) input.value = '';
      return;
    }

    // Strip titles (Mwl., Mr., Mrs., Ms., Dr., Tr.)
    let clean = fullName.replace(/^(mwl\.?|mr\.?|mrs\.?|ms\.?|dr\.?|tr\.?)\s+/i, '').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return;

    const firstName = parts[0].replace(/[^a-zA-Z0-9]/g, '');
    const lastName = parts.length > 1 ? parts[parts.length - 1].replace(/[^a-zA-Z0-9]/g, '') : '';
    const generated = (firstName + lastName).toUpperCase();

    input.value = generated;
  },

  async refreshGeneratedUsername(fullNameInputId, usernameInputId) {
    const nameInput = document.getElementById(fullNameInputId);
    const usernameInput = document.getElementById(usernameInputId);
    if (!nameInput || !usernameInput) return;

    const name = nameInput.value.trim();
    if (!name) {
      this.showToast('Please enter the Teacher\'s Full Name first.', 'warning');
      nameInput.focus();
      return;
    }

    try {
      const res = await API.generateUsername(name, State.currentSchool?.id);
      if (res.username) {
        usernameInput.value = res.username;
        this.showToast(`Generated unique username: ${res.username}`, 'info');
      }
    } catch (err) {
      this.handleTeacherNameInput(name, usernameInputId);
    }
  },

  async loadSubjectsAndClassesForTeacherForm(subjectsWrapId, classesWrapId, selectedSubjectIds = [], selectedClassAllocations = []) {
    const subjectsWrap = document.getElementById(subjectsWrapId);
    const classesWrap = document.getElementById(classesWrapId);
    if (!subjectsWrap || !classesWrap) return;

    const setStatus = (container, message, color) => {
      const status = document.createElement('span');
      Object.assign(status.style, { color, fontSize: '0.78rem' });
      status.textContent = message;
      container.replaceChildren(status);
    };
    setStatus(subjectsWrap, 'Loading subjects...', 'var(--slate-400)');
    setStatus(classesWrap, 'Loading classes & streams...', 'var(--slate-400)');

    try {
      const [subjectsRes, classesRes] = await Promise.all([
        API.getSubjects(State.currentSchool?.id),
        API.getClasses(State.currentSchool?.id)
      ]);

      const subjects = subjectsRes.subjects || [];
      const classes = classesRes.classes || [];

      if (subjects.length === 0) {
        setStatus(subjectsWrap, 'No subjects registered in this school.', 'var(--slate-400)');
      } else {
        subjectsWrap.replaceChildren(...subjects.map(s => {
          const label = document.createElement('label');
          label.style.display = 'flex';
          label.style.alignItems = 'center';
          label.style.gap = '8px';
          label.style.fontSize = '0.82rem';
          label.style.cursor = 'pointer';
          label.style.userSelect = 'none';

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.name = 'subjectIds';
          checkbox.value = String(s.id);
          checkbox.checked = selectedSubjectIds.includes(s.id);

          const text = createSafeTextLabel(s.code, s.name, { className: 'subject-label' });

          label.appendChild(checkbox);
          label.appendChild(text);
          return label;
        }));
      }

      if (classes.length === 0) {
        setStatus(classesWrap, 'No classes registered.', 'var(--slate-400)');
      } else {
        classesWrap.replaceChildren(...classes.map(c => {
          const block = document.createElement('div');
          block.style.marginBottom = '10px';
          block.style.borderBottom = '1px solid var(--slate-200)';
          block.style.paddingBottom = '8px';

          const heading = document.createElement('div');
          heading.style.fontWeight = '700';
          heading.style.fontSize = '0.84rem';
          heading.style.color = 'var(--slate-800)';
          heading.style.marginBottom = '6px';
          heading.textContent = c.name;

          const streamWrap = document.createElement('div');
          streamWrap.style.display = 'flex';
          streamWrap.style.gap = '12px';
          streamWrap.style.flexWrap = 'wrap';

          const streams = c.streams || [];
          if (streams.length === 0) {
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.gap = '6px';
            label.style.fontSize = '0.8rem';
            label.style.cursor = 'pointer';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.name = 'classAllocations';
            input.value = `${c.id}_0`;
            const text = document.createElement('span');
            text.textContent = `All ${c.name}`;
            label.appendChild(input); label.appendChild(text);
            streamWrap.appendChild(label);
          } else {
            streams.forEach(st => {
              const key = `${c.id}_${st.id}`;
              const isChecked = selectedClassAllocations.some(ca => (typeof ca === 'string' && ca === key) || (typeof ca === 'object' && ca.classId === c.id && ca.streamId === st.id));
              const label = document.createElement('label');
              label.style.display = 'flex';
              label.style.alignItems = 'center';
              label.style.gap = '6px';
              label.style.fontSize = '0.8rem';
              label.style.cursor = 'pointer';
              const input = document.createElement('input');
              input.type = 'checkbox';
              input.name = 'classAllocations';
              input.value = key;
              input.checked = isChecked;
              const text = document.createElement('span');
              text.textContent = st.name;
              label.appendChild(input); label.appendChild(text); streamWrap.appendChild(label);
            });
          }
          block.appendChild(heading); block.appendChild(streamWrap); return block;
        }));
      }
    } catch (err) {
      setStatus(subjectsWrap, 'Error loading subjects.', 'var(--danger)');
      setStatus(classesWrap, 'Error loading classes.', 'var(--danger)');
    }
  },

  async openNewTeacherModal() {
    const modal = document.getElementById('new-teacher-modal');
    if (!modal) return;

    const form = document.getElementById('new-teacher-form');
    if (form) form.reset();

    // Next sequential number S/N
    const snBadge = document.getElementById('new-teacher-sn');
    if (snBadge) {
      const nextSn = (State.teachersCount || 0) + 1;
      snBadge.innerText = `#${nextSn}`;
    }

    // Load subjects and classes checkboxes
    await this.loadSubjectsAndClassesForTeacherForm(
      'new-teacher-subjects-wrap',
      'new-teacher-classes-wrap'
    );

    modal.classList.add('active');
  },

  async handleRegisterTeacherSubmit(event) {
    event.preventDefault();
    const form = event.target;

    const fullName = form.fullName.value.trim();
    const gender = form.gender.value;
    const phone = form.phone.value.trim();
    let username = form.username.value.trim();

    if (!fullName) {
      this.showToast('Please enter the Teacher\'s Full Name.', 'warning');
      form.fullName.focus();
      return;
    }

    // Gather selected subjects
    const subjectCheckboxes = form.querySelectorAll('input[name="subjectIds"]:checked');
    const subjectIds = Array.from(subjectCheckboxes).map(cb => parseInt(cb.value, 10));

    // Gather selected classes & streams
    const classCheckboxes = form.querySelectorAll('input[name="classAllocations"]:checked');
    const classAllocations = Array.from(classCheckboxes).map(cb => cb.value);

    const teacherData = {
      fullName,
      gender,
      phone,
      username,
      subjectIds,
      classAllocations,
      schoolId: State.currentSchool?.id
    };

    try {
      this.showToast('Registering teacher and creating user account...', 'info');
      const res = await API.createTeacher(teacherData);
      const created = res.teacher;
      this.showToast(`Teacher Mwl. ${created.first_name} ${created.last_name} registered! Username: ${created.username}`, 'success');
      this.closeModal('new-teacher-modal');
      form.reset();
      this.render();
    } catch (err) {
      this.showToast(`Failed to register teacher: ${err.message}`, 'danger');
    }
  },

  async openEditTeacherModal(teacherId) {
    const modal = document.getElementById('edit-teacher-modal');
    if (!modal) return;

    try {
      const res = await API.getTeacher(teacherId, State.currentSchool?.id);
      const teacher = res.teacher;
      if (!teacher) throw new Error('Teacher record could not be found.');

      document.getElementById('edit-teacher-id').value = teacher.id;
      document.getElementById('edit-teacher-sn').innerText = `#${teacher.id}`;
      document.getElementById('edit-teacher-fullname').value = teacher.fullName || `${teacher.first_name} ${teacher.last_name}`;
      document.getElementById('edit-teacher-gender').value = teacher.gender || 'M';
      document.getElementById('edit-teacher-phone').value = teacher.phone || '';
      document.getElementById('edit-teacher-username').value = teacher.username || '';
      document.getElementById('edit-teacher-status').value = teacher.status || 'ACTIVE';

      const selectedSubIds = (teacher.subjects || []).map(s => s.id);
      const selectedClasses = (teacher.assignedClasses || []).map(c => `${c.classId}_${c.streamId || 0}`);

      await this.loadSubjectsAndClassesForTeacherForm(
        'edit-teacher-subjects-wrap',
        'edit-teacher-classes-wrap',
        selectedSubIds,
        selectedClasses
      );

      modal.classList.add('active');
    } catch (err) {
      this.showToast(`Error opening teacher edit form: ${err.message}`, 'danger');
    }
  },

  async handleUpdateTeacherSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const teacherId = parseInt(form.teacherId.value, 10);

    const fullName = form.fullName.value.trim();
    const gender = form.gender.value;
    const phone = form.phone.value.trim();
    const username = form.username.value.trim();
    const status = form.status.value;

    const subjectCheckboxes = form.querySelectorAll('input[name="subjectIds"]:checked');
    const subjectIds = Array.from(subjectCheckboxes).map(cb => parseInt(cb.value, 10));

    const classCheckboxes = form.querySelectorAll('input[name="classAllocations"]:checked');
    const classAllocations = Array.from(classCheckboxes).map(cb => cb.value);

    const updateData = {
      fullName,
      gender,
      phone,
      username,
      status,
      subjectIds,
      classAllocations,
      schoolId: State.currentSchool?.id
    };

    try {
      this.showToast('Updating teacher record and subject allocations...', 'info');
      const res = await API.updateTeacher(teacherId, updateData);
      const updated = res.teacher;
      this.showToast(`Teacher Mwl. ${updated.first_name} ${updated.last_name} updated successfully!`, 'success');
      this.closeModal('edit-teacher-modal');
      this.render();
    } catch (err) {
      this.showToast(`Update failed: ${err.message}`, 'danger');
    }
  },

  async handleDeleteTeacher(teacherId, teacherName) {
    const confirmed = confirm(`Are you sure you want to remove teacher Mwl. ${teacherName}? All subject allocations will also be unassigned.`);
    if (!confirmed) return;

    try {
      this.showToast(`Removing teacher ${teacherName}...`, 'info');
      await API.deleteTeacher(teacherId, State.currentSchool?.id);
      this.showToast(`Teacher ${teacherName} deleted.`, 'info');
      this.render();
    } catch (err) {
      this.showToast(`Failed to delete teacher: ${err.message}`, 'danger');
    }
  }
};

// ==========================================
// EXAM MODAL FIX (V2 - Dynamic Fetching)
// ==========================================
/**
 * MR LOGIC SCHOOL SYSTEM - API Client
 */

// ==========================================
// SEHEMU YA KUSAJILI MTIHANI (FIX)
// ==========================================
App.openNewExamModal = async function() {
    const modal = document.getElementById('new-exam-modal');
    if (!modal) { alert("Kosa: Fomu haipo!"); return; }

    const form = document.getElementById('new-exam-form');
    if (form) form.reset();

    // 1. Pakia Madarasa (Class)
    const classSelect = document.getElementById('exam-class');
    if(classSelect) { 
        classSelect.innerHTML = '<option value="">Select Class</option>'; 
        try {
            const res = await API.getClasses();
            if (res && res.classes) res.classes.forEach(c => classSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`);
        } catch (e) { console.error("Kosa kupata madarasa:", e); }
    }
    
    // 2. Pakia Miaka (Academic Year)
    const yearSelect = document.getElementById('exam-year');
    const termSelect = document.getElementById('exam-term');
    
    if(yearSelect) { 
        yearSelect.innerHTML = '<option value="">Select Year</option>'; 
        if(termSelect) termSelect.innerHTML = '<option value="">Select Year First</option>'; 
        try {
            const res = await API.getYears();
            if (res && res.years) {
                res.years.forEach(y => yearSelect.innerHTML += `<option value="${y.id}">${y.year_label}</option>`);
            }
        } catch (e) { console.error("Kosa kupata miaka:", e); }
    }

    // 3. Unganisha Year na Term
    if(yearSelect && termSelect) {
        yearSelect.onchange = async function() {
            const selectedYearId = this.value;
            termSelect.innerHTML = '<option value="">Loading terms...</option>';
            
            if (!selectedYearId) {
                termSelect.innerHTML = '<option value="">Select Year First</option>';
                return;
            }

            try {
                const res = await API.getTerms(selectedYearId);
                termSelect.innerHTML = '<option value="">Select Term</option>';
                if (res && res.terms) {
                    res.terms.forEach(t => termSelect.innerHTML += `<option value="${t.id}">${t.term_name}</option>`);
                }
            } catch (e) { 
                console.error("Kosa kupata mihula:", e); 
                termSelect.innerHTML = '<option value="">Error loading terms</option>';
            }
        };
    }

    modal.classList.add('active');
};

App.handleCreateExamSubmit = async function(e) {
    e.preventDefault();
    
    const classVal = document.getElementById('exam-class').value;
    const yearVal = document.getElementById('exam-year').value;
    const termVal = document.getElementById('exam-term').value;

    if (!classVal || !yearVal || !termVal) {
        alert("Tafadhali chagua Class, Academic Year, na Term kwanza!");
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

    try {
        await API.createExam(data);
        alert('Mtihani umesajiliwa kikamilifu!'); 
        this.closeModal('new-exam-modal'); 
        e.target.reset(); 
        this.render(); 
    } catch (err) { 
        alert('Kosa la kusajili: ' + err.message); 
    }
};