/**
 * MR LOGIC SCHOOL SYSTEM - School Leaders + login for non-SUPER_ADMIN roles
 */
(function () {
  const ROLE_LABELS = {
    SCHOOL_ADMIN: 'School Admin',
    HEAD_TEACHER: 'Mkuu wa Shule',
    SCHOOL_MANAGER: 'Meneja wa Shule',
    ACADEMIC_MASTER: 'Mtaaluma Mkuu',
    ACADEMIC_ASSISTANT: 'Mtaaluma Msaidizi'
  };

  // Users who are not SUPER_ADMIN only see and load their own school.
  const originalLoad = App.loadInitialData.bind(App);
  App.loadInitialData = async function () {
    const user = State.currentUser;
    if (!user || user.role === 'SUPER_ADMIN') return originalLoad();

    const data = await API.request(`/api/schools/${user.school_id}`);
    State.schools = data.school ? [data.school] : [];

    const select = document.getElementById('school-selector');
    if (select) {
      select.replaceChildren();
      State.schools.forEach(s => select.appendChild(createSafeOption(s.id, `${s.name} (${s.code})`)));
      select.disabled = true;
    }
    State.setSchool(State.schools[0] || null);
    if (select && State.schools[0]) select.value = String(State.schools[0].id);
  };

  App.openStaffModal = async function (schoolId, schoolName) {
    const modal = document.getElementById('staff-modal');
    const form = document.getElementById('staff-form');
    if (!modal || !form) return;
    document.getElementById('staff-modal-title').textContent = `School Leaders - ${schoolName}`;
    form.reset();
    form.elements.schoolId.value = schoolId;
    document.getElementById('staff-result').style.display = 'none';
    modal.classList.add('active');
    await this.loadStaffList(schoolId);
  };

  App.loadStaffList = async function (schoolId) {
    const wrap = document.getElementById('staff-list');
    wrap.replaceChildren(createLoadingState('Loading leaders...'));
    try {
      const data = await API.request(`/api/schools/${schoolId}/staff`);
      const staff = data.staff || [];
      if (staff.length === 0) {
        const empty = document.createElement('div');
        empty.style.color = 'var(--slate-500)';
        empty.textContent = 'Hakuna kiongozi aliyesajiliwa bado.';
        wrap.replaceChildren(empty);
        return;
      }
      const table = document.createElement('table');
      table.className = 'data-table';
      const thead = document.createElement('thead');
      const hr = document.createElement('tr');
      ['NAME', 'USERNAME', 'ROLE', 'STATUS'].forEach(l => {
        const th = document.createElement('th');
        th.textContent = l;
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      const tbody = document.createElement('tbody');
      staff.forEach(u => {
        const tr = document.createElement('tr');
        [u.full_name, u.username, ROLE_LABELS[u.role] || u.role, u.is_active ? 'Active' : 'Inactive']
          .forEach(v => {
            const td = document.createElement('td');
            td.textContent = v == null ? '-' : String(v);
            tr.appendChild(td);
          });
        tbody.appendChild(tr);
      });
      table.append(thead, tbody);
      wrap.replaceChildren(table);
    } catch (err) {
      wrap.replaceChildren(createErrorState(`Failed to load leaders: ${err.message}`));
    }
  };

  App.handleStaffSubmit = async function (event) {
    event.preventDefault();
    const form = event.target;
    const f = form.elements;
    const schoolId = Number(f.schoolId.value);
    try {
      const res = await API.request(`/api/schools/${schoolId}/staff`, {
        method: 'POST',
        body: { fullName: f.fullName.value.trim(), role: f.role.value, phone: f.phone.value.trim() }
      });
      const box = document.getElementById('staff-result');
      box.replaceChildren();
      const note = document.createElement('div');
      note.textContent = 'Akaunti imetengenezwa. Mpe mtumiaji taarifa hizi (nywila haitaonyeshwa tena):';
      const u = document.createElement('div');
      u.append('Username: ', createStrongText(res.user.username));
      const p = document.createElement('div');
      p.append('Password: ', createStrongText(res.temporaryPassword || '(uliyoiweka mwenyewe)'));
      box.append(note, u, p);
      box.style.display = '';
      form.reset();
      f.schoolId.value = schoolId;
      await this.loadStaffList(schoolId);
    } catch (err) {
      this.showToast(`Failed to create account: ${err.message}`, 'danger');
    }
  };
})();