// ... (Weka code zote za mwanzo za levelSetup.js hapa mpaka kwenye ensureLevelSubjects) ...

async function ensureLevelSetup(schoolId, levels) {
  const list = toLevelList(levels);
  
  // Tunatengeneza madarasa na kurudisha idadi yake
  let createdClassesCount = 0;
  for (const level of list) {
    for (const c of LEVEL_CLASSES[level] || []) {
      const existing = await db.get(`SELECT id FROM classes WHERE school_id = ? AND name = ?`, [schoolId, c.name]);
      if (existing) continue;
      
      const res = await db.run(`INSERT INTO classes (school_id, form_level, name, numeric_order, level_type) VALUES (?, ?, ?, ?, ?)`, [schoolId, c.level, c.name, c.order, level]);
      const classId = res.lastInsertRowid;
      
      if (classId) {
        createdClassesCount++;
        for (const streamName of ['Stream A', 'Stream B', 'Stream C', 'Stream D']) {
          await db.run(`INSERT INTO streams (school_id, class_id, name) VALUES (?, ?, ?)`, [schoolId, classId, streamName]);
        }
      }
    }
  }

  await ensureLevelSubjects(schoolId, list);
  
  // Tunarudisha idadi ya madarasa yaliyotengenezwa
  return createdClassesCount;
}

module.exports = { ensureLevelSetup };