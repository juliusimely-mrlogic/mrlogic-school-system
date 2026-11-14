document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  if (!token) { window.location.href = '/'; return; }

  const authHeaders = { 'Authorization': `Bearer ${token}` };
  const loading = document.getElementById('loading');
  const statsContainer = document.getElementById('stats-container');

  loading.style.display = 'block';

  try {
    const res = await fetch('/api/dashboard/stats', { headers: authHeaders });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Imeshindwa kupata data");

    // Weka Jina la Shule
    document.getElementById('school-name').textContent = `Takwimu za ${data.schoolName}`;

    // Jaza Kadi za Takwimu
    document.getElementById('total-students').textContent = data.totalStudents;
    document.getElementById('total-teachers').textContent = data.totalTeachers;
    document.getElementById('total-classes').textContent = data.totalClasses;
    
    // Format Pesa
    const formatMoney = (amount) => {
        return "Tsh " + parseInt(amount).toLocaleString('en-US');
    };
    document.getElementById('collected-fees').textContent = formatMoney(data.totalCollectedFees);
    document.getElementById('outstanding-fees').textContent = formatMoney(data.totalOutstandingFees);

    // Weka Kadi ya Nafasi ya Shule (Halmashauri)
    document.getElementById('district-rank').textContent = data.districtRank;
    document.getElementById('total-schools').textContent = data.totalSchoolsInDistrict;

    // Onyesha Kadi
    loading.style.display = 'none';
    statsContainer.style.display = 'grid';

  } catch (error) {
    loading.textContent = `Kosa: ${error.message}`;
    loading.style.color = '#ef4444';
  }

  // Logout Logic
  document.getElementById('logout-btn').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  });
});