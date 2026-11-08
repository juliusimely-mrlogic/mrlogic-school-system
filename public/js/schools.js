/**
 * MR LOGIC SCHOOL SYSTEM - Schools Registration (SUPER_ADMIN)
 * Extends App without editing app.js
 */
(function () {
  const LEVEL_LABELS = { PRIMARY: 'Primary', O_LEVEL: 'O-Level', A_LEVEL: 'A-Level' };
  const originalRender = App.render.bind(App);

  App.render = function () {
    const isSuper = !!(State.currentUser && State.currentUser.role === 'SUPER_ADMIN');
    const nav = document.getElementById('nav-schools');
    if (nav) nav.style.display = isSuper ? '' : 'none';

    if (State.activeView === 'schools' && isSuper) {
      this.updateRoleUI();
      const content = document.getElementById('content-area');
      if (content) this.renderSchools(content);
      return;
    }
    originalRender();
  };

  function cell(text) {
    const td = document.createElement('td');
    td.textContent = text == null || text === '' ? '-' : String(text);
    return td;
  }

  App.renderSchools = async function (container) {
    container.replaceChildren(createLoadingState('Loading schools...'));
    try {
      const data = await API.getSchools();
      const schools = data.schools || [];
      this._schoolsCache = schools;

      const card = document.createElement('div');
      card.className = 'card';

      const header = document.createElement('div');
      header.className = 'card-header';
      const titleWrap = document.createElement('div');
      const title = document.createElement('h3');
      title.className = 'card-title';
      title.textContent = 'Registered Schools';
      const subtitle = document.createElement('div');
      subtitle.className = 'card-subtitle';
      subtitle.textContent = `Total: ${schools.length} schools`;
      titleWrap.append(title, subtitle);
      const addBtn = createActionButton('+ Register School', {
        className: 'btn btn-emerald',
        onclick: () => App.openSchoolModal()
      });
      header.append(titleWrap, addBtn);

      const tableWrap = document.createElement('div');
      tableWrap.className = 'table-responsive';
      const table = document.createElement('table');
      table.className = 'data-table';
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      ['S/N', 'SCHOOL', 'CODE', 'REGION', 'COUNCIL', 'WARD', 'OWNERSHIP', 'LEVELS',
        'STUDENTS', 'TEACHERS', 'STATUS', 'ACTIONS'].forEach(label => {
        const th = document.createElement('th');
        th.textContent = label;
        if (label === 'ACTIONS') th.style.textAlign = 'right';
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);

      const tbody = document.createElement('tbody');
      schools.forEach((s, i) => {
        const row = document.createElement('tr');
        const levels = String(s.school_levels || 'O_LEVEL').split(',')
          .map(l => LEVEL_LABELS[l] || l).join(', ');
        const nameTd = document.createElement('td');
        nameTd.appendChild(createStrongText(s.name));
        const statusTd = document.createElement('td');
        statusTd.appendChild(createBadge(s.is_active ? 'Active' : 'Inactive'));
        const actionsTd = document.createElement('td');
        actionsTd.style.textAlign = 'right';
        actionsTd.appendChild(createActionButton('✏️ Edit', {
          onclick: () => App.openSchoolModal(s.id)
        }));
        actionsTd.appendChild(createActionButton('👥 Leaders', {
          onclick: () => App.openStaffModal(s.id, s.name)
        }));
        row.append(
          cell('#' + (i + 1)), nameTd, cell(s.code), cell(s.region), cell(s.district),
          cell(s.ward), cell(s.owner_type === 'PRIVATE' ? 'Private' : 'Government'),
          cell(levels), cell(s.total_students ?? 0), cell(s.total_teachers ?? 0),
          statusTd, actionsTd
        );
        tbody.appendChild(row);
      });

      table.append(thead, tbody);
      tableWrap.appendChild(table);
      card.append(header, tableWrap);
      container.replaceChildren(card);
    } catch (err) {
      container.replaceChildren(createErrorState(`Failed to load schools: ${err.message}`));
    }
  };

  App.openSchoolModal = function (schoolId) {
    const modal = document.getElementById('school-modal');
    const form = document.getElementById('school-form');
    if (!modal || !form) return;
    form.reset();
    const f = form.elements;
    const school = schoolId ? (this._schoolsCache || []).find(s => s.id === schoolId) : null;

    document.getElementById('school-modal-title').textContent =
      school ? 'Edit School' : 'Register New School';
    document.getElementById('school-active-wrap').style.display = school ? '' : 'none';
    f.schoolId.value = school ? school.id : '';
    f.code.disabled = !!school;

    const levels = school ? String(school.school_levels || 'O_LEVEL').split(',') : ['O_LEVEL'];
    let langs = ['sw'];
    if (school) {
      try { langs = JSON.parse(school.languages || '["sw"]'); } catch (e) { langs = ['sw']; }
    }
    form.querySelectorAll('input[name="schoolLevels"]').forEach(cb => {
      cb.checked = levels.includes(cb.value);
    });
    form.querySelectorAll('input[name="languages"]').forEach(cb => {
      cb.checked = langs.includes(cb.value);
    });
    f.ownerType.value = school ? (school.owner_type || 'GOVERNMENT') : 'GOVERNMENT';

    if (school) {
      f.name.value = school.name || '';
      f.code.value = school.code || '';
      f.examNumber.value = school.exam_number || '';
      f.region.value = school.region || '';
      f.district.value = school.district || '';
      f.ward.value = school.ward || '';
      f.headTeacherName.value = school.head_teacher_name || '';
      f.phone.value = school.phone || '';
      f.email.value = school.email || '';
      f.registrationNumber.value = school.registration_number || '';
      f.motto.value = school.motto || '';
      f.address.value = school.address || '';
      f.isActive.checked = !!school.is_active;
    }
    modal.classList.add('active');
  };

  App.handleSchoolSubmit = async function (event) {
    event.preventDefault();
    const form = event.target;
    const f = form.elements;
    const id = f.schoolId.value;

    const levels = Array.from(form.querySelectorAll('input[name="schoolLevels"]:checked')).map(x => x.value);
    const langs = Array.from(form.querySelectorAll('input[name="languages"]:checked')).map(x => x.value);
    if (!levels.length) { this.showToast('Chagua angalau ngazi moja ya shule.', 'warning'); return; }
    if (!langs.length) { this.showToast('Chagua angalau lugha moja.', 'warning'); return; }

    const payload = {
      name: f.name.value.trim(),
      examNumber: f.examNumber.value.trim(),
      region: f.region.value.trim(),
      district: f.district.value.trim(),
      ward: f.ward.value.trim(),
      headTeacherName: f.headTeacherName.value.trim(),
      ownerType: f.ownerType.value,
      schoolLevels: levels,
      languages: langs,
      phone: f.phone.value.trim(),
      email: f.email.value.trim(),
      registrationNumber: f.registrationNumber.value.trim(),
      motto: f.motto.value.trim(),
      address: f.address.value.trim()
    };

    try {
      if (id) {
        payload.isActive = f.isActive.checked;
        await API.updateSchool(Number(id), payload);
        this.showToast('School updated.', 'success');
      } else {
        payload.code = f.code.value.trim();
        const res = await API.createSchool(payload);
        this.showToast(`School registered: ${res.school.name}`, 'success');
      }
      this.closeModal('school-modal');
      await this.loadInitialData();
      this.render();
    } catch (err) {
      this.showToast(`Failed to save school: ${err.message}`, 'danger');
    }
  };
})();