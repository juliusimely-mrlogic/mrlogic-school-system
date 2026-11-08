/**
 * MR LOGIC SCHOOL SYSTEM - Zero-Dependency SVG Visualization Engine
 */
const Charts = {
  renderDivisionDistribution(distribution) {
    if (!distribution || distribution.total === 0) {
      return `<div class="card-subtitle" style="text-align: center; padding: 24px;">No examination results processed yet.</div>`;
    }

    const divs = [
      { key: 'I', label: 'Division I', class: 'fill-div-1', color: 'var(--div-1-color)', count: distribution['I'] || 0 },
      { key: 'II', label: 'Division II', class: 'fill-div-2', color: 'var(--div-2-color)', count: distribution['II'] || 0 },
      { key: 'III', label: 'Division III', class: 'fill-div-3', color: 'var(--div-3-color)', count: distribution['III'] || 0 },
      { key: 'IV', label: 'Division IV', class: 'fill-div-4', color: 'var(--div-4-color)', count: distribution['IV'] || 0 },
      { key: '0', label: 'Division 0', class: 'fill-div-0', color: 'var(--div-0-color)', count: distribution['0'] || 0 }
    ];

    const total = distribution.total;

    return `
      <div class="division-bars-list">
        ${divs.map(d => {
          const pct = total > 0 ? ((d.count / total) * 100).toFixed(1) : '0';
          return `
            <div class="division-bar-row">
              <div class="div-label-col">
                <span class="badge badge-div-${d.key === '0' ? '0' : d.key.toLowerCase()}">${d.label}</span>
              </div>
              <div class="div-progress-track">
                <div class="div-progress-fill ${d.class}" style="width: ${pct}%;"></div>
              </div>
              <div class="div-stat-col">
                ${d.count} <small style="color: var(--slate-400); font-weight: normal;">(${pct}%)</small>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  renderGenderRatio(boys, girls) {
    const total = boys + girls;
    if (total === 0) return '';
    const boysPct = ((boys / total) * 100).toFixed(1);
    const girlsPct = ((girls / total) * 100).toFixed(1);

    return `
      <div style="display: flex; gap: 8px; margin-top: 8px;">
        <span class="badge badge-male" style="flex: 1; justify-content: center; padding: 5px;">
          Boys: ${boys} (${boysPct}%)
        </span>
        <span class="badge badge-female" style="flex: 1; justify-content: center; padding: 5px;">
          Girls: ${girls} (${girlsPct}%)
        </span>
      </div>
    `;
  }
};
