/**
 * MR LOGIC SCHOOL SYSTEM - Level setup (classes, subjects, combinations)
 * Primary classes use negative numeric_order so they sort before Forms
 * without changing existing Form 1-4 ordering.
 *
 * A-Level combinations follow the TAHASUSI (Secondary School 2025) list.
 * PDF items #58 (KLMu, same subjects as #61 KLiMu) and #60 (same as #44 FaLMu)
 * are duplicates and are not repeated, so 86 unique combinations are created.
 */
const db = require('../db/database');

const LEVEL_CLASSES = {
  PRIMARY: [1, 2, 3, 4, 5, 6, 7].map(n => ({ level: n, name: `Standard ${n}`, order: n - 8 })),
  O_LEVEL: [1, 2, 3, 4].map(n => ({ level: n, name: `Form ${n}`, order: n })),
  A_LEVEL: [5, 6].map(n => ({ level: n, name: `Form ${n}`, order: n }))
};

const DEFAULT_OLEVEL_SUBJECTS = [
  { code: 'B/MATH', name: 'Basic Mathematics', category: 'SCIENCE' },
  { code: 'ENG', name: 'English Language', category: 'ARTS' },
  { code: 'KISW', name: 'Kiswahili', category: 'ARTS' },
  { code: 'BIO', name: 'Biology', category: 'SCIENCE' },
  { code: 'CHEM', name: 'Chemistry', category: 'SCIENCE' },
  { code: 'PHY', name: 'Physics', category: 'SCIENCE' },
  { code: 'HIST', name: 'History', category: 'ARTS' },
  { code: 'GEO', name: 'Geography', category: 'ARTS' },
  { code: 'CIV', name: 'Civics', category: 'ARTS' },
  { code: 'BKPG', name: 'Bookkeeping', category: 'BUSINESS' },
  { code: 'COMM', name: 'Commerce', category: 'BUSINESS' }
];

// Subject catalog: key -> name and category (used for O-Level extras and A-Level).
const SUBJECTS = {
  PHY: { name: 'Physics', category: 'SCIENCE' },
  CHEM: { name: 'Chemistry', category: 'SCIENCE' },
  BIO: { name: 'Biology', category: 'SCIENCE' },
  AMATH: { name: 'Advanced Mathematics', category: 'SCIENCE' },
  CS: { name: 'Computer Science', category: 'SCIENCE' },
  AGRI: { name: 'Agriculture', category: 'SCIENCE' },
  FHN: { name: 'Food and Human Nutrition', category: 'SCIENCE' },
  ICT: { name: 'ICT', category: 'SCIENCE' },
  COMP: { name: 'Computer Studies', category: 'SCIENCE' },
  GEO: { name: 'Geography', category: 'ARTS' },
  HIST: { name: 'History', category: 'ARTS' },
  KISW: { name: 'Kiswahili', category: 'ARTS' },
  ENG: { name: 'English Language', category: 'ARTS' },
  LIT: { name: 'Literature in English', category: 'ARTS' },
  FAK: { name: 'Fasihi ya Kiswahili', category: 'ARTS' },
  FRE: { name: 'French', category: 'ARTS' },
  ARA: { name: 'Arabic', category: 'ARTS' },
  CHI: { name: 'Chinese', category: 'ARTS' },
  MUS: { name: 'Music', category: 'ARTS' },
  SPO: { name: 'Sports', category: 'ARTS' },
  THEA: { name: 'Theatre Arts', category: 'ARTS' },
  FIA: { name: 'Fine Arts', category: 'ARTS' },
  TGC: { name: 'Textile and Garment Construction', category: 'ARTS' },
  TOUR: { name: 'Tourism', category: 'ARTS' },
  IKN: { name: 'Islamic Knowledge', category: 'ARTS' },
  DIV: { name: 'Divinity', category: 'ARTS' },
  HTM: { name: 'Historia ya Tanzania na Maadili', category: 'ARTS' },
  ECON: { name: 'Economics', category: 'BUSINESS' },
  BUS: { name: 'Business Studies', category: 'BUSINESS' },
  ACC: { name: 'Accountancy', category: 'BUSINESS' },
  AC: { name: 'Academic Communication', category: 'GENERAL' },
  BAM: { name: 'Basic Applied Mathematics', category: 'GENERAL' }
};

// Extra O-Level subjects (elective), added to every school that has O-Level.
const OLEVEL_EXTRA_KEYS = [
  'HTM', 'BUS', 'FAK', 'THEA', 'FIA', 'AGRI', 'ICT', 'COMP',
  'LIT', 'FRE', 'ARA', 'CHI', 'IKN', 'DIV', 'FHN', 'MUS', 'SPO', 'TGC'
];
const OLEVEL_EXTRA_SUBJECTS = OLEVEL_EXTRA_KEYS.map(k => ({
  code: k, name: SUBJECTS[k].name, category: SUBJECTS[k].category, core: false
}));

const PRIMARY_SUBJECTS = [
  { code: 'P-KISW', name: 'Kiswahili', category: 'GENERAL' },
  { code: 'P-ENG', name: 'English Language', category: 'GENERAL' },
  { code: 'P-MAARIFA', name: 'Maarifa ya Jamii', category: 'GENERAL' },
  { code: 'P-HESABU', name: 'Hisabati', category: 'GENERAL' },
  { code: 'P-SAYANSI', name: 'Sayansi na Teknolojia', category: 'GENERAL' },
  { code: 'P-URAIA', name: 'Uraia na Maadili', category: 'GENERAL' }
];

// A-Level: principal subjects (used in combinations) and subsidiary subjects (no combination).
const A_LEVEL_PRINCIPAL_KEYS = [
  'PHY', 'CHEM', 'BIO', 'AMATH', 'CS', 'AGRI', 'FHN',
  'GEO', 'HIST', 'KISW', 'ENG', 'LIT', 'FAK', 'FRE', 'ARA', 'CHI',
  'MUS', 'SPO', 'THEA', 'FIA', 'TGC', 'TOUR', 'IKN', 'DIV',
  'ECON', 'BUS', 'ACC'
];
const A_LEVEL_SUBSIDIARY_KEYS = ['AC', 'BAM', 'HTM'];

const A_LEVEL_SUBJECTS = [
  ...A_LEVEL_PRINCIPAL_KEYS.map(k => ({
    code: `A-${k}`, name: SUBJECTS[k].name, category: SUBJECTS[k].category, role: 'PRINCIPAL'
  })),
  ...A_LEVEL_SUBSIDIARY_KEYS.map(k => ({
    code: `A-${k}`, name: SUBJECTS[k].name, category: 'GENERAL', role: 'SUBSIDIARY'
  }))
];

// Combination code -> subject keys ("Mathematics" in the PDF = Advanced Mathematics, key AMATH).
const COMBINATION_DEFS = [
  // 01: SOCIAL SCIENCE
  ['HGK', ['HIST', 'GEO', 'KISW']],
  ['HGL', ['HIST', 'GEO', 'ENG']],
  ['HGF', ['HIST', 'GEO', 'FRE']],
  ['HKL', ['HIST', 'KISW', 'ENG']],
  ['HGE', ['HIST', 'GEO', 'ECON']],
  ['HGAr', ['HIST', 'GEO', 'ARA']],
  ['HGCh', ['HIST', 'GEO', 'CHI']],
  ['HGFa', ['HIST', 'GEO', 'FAK']],
  ['HGLi', ['HIST', 'GEO', 'LIT']],
  ['KLF', ['KISW', 'ENG', 'FRE']],
  ['KLAr', ['KISW', 'ENG', 'ARA']],
  ['KLCh', ['KISW', 'ENG', 'CHI']],
  // 02: LANGUAGE
  ['KArCh', ['KISW', 'ARA', 'CHI']],
  ['KArF', ['KISW', 'ARA', 'FRE']],
  ['LFAr', ['ENG', 'FRE', 'ARA']],
  ['LFCh', ['ENG', 'FRE', 'CHI']],
  ['FArCh', ['FRE', 'ARA', 'CHI']],
  ['HLF', ['HIST', 'ENG', 'FRE']],
  ['HLAr', ['HIST', 'ENG', 'ARA']],
  ['BuLF', ['BUS', 'ENG', 'FRE']],
  ['FLE', ['FRE', 'ENG', 'ECON']],
  ['HLCh', ['HIST', 'ENG', 'CHI']],
  // 03: BUSINESS STUDIES
  ['EBuAc', ['ECON', 'BUS', 'ACC']],
  ['EGM', ['ECON', 'GEO', 'AMATH']],
  ['ECsM', ['ECON', 'CS', 'AMATH']],
  ['BuAcCs', ['BUS', 'ACC', 'CS']],
  ['BuAcM', ['BUS', 'ACC', 'AMATH']],
  ['EBuI', ['ECON', 'BUS', 'IKN']],
  ['EBuD', ['ECON', 'BUS', 'DIV']],
  ['MEBu', ['AMATH', 'ECON', 'BUS']],
  ['BuEL', ['BUS', 'ECON', 'ENG']],
  ['BuEChi', ['BUS', 'ECON', 'CHI']],
  ['BuEAr', ['BUS', 'ECON', 'ARA']],
  ['BuEF', ['BUS', 'ECON', 'FRE']],
  // 04: SCIENCE
  ['PCM', ['PHY', 'CHEM', 'AMATH']],
  ['PCB', ['PHY', 'CHEM', 'BIO']],
  ['PGM', ['PHY', 'GEO', 'AMATH']],
  ['PMCs', ['PHY', 'AMATH', 'CS']],
  ['CBA', ['CHEM', 'BIO', 'AGRI']],
  ['CBN', ['CHEM', 'BIO', 'FHN']],
  ['CBG', ['CHEM', 'BIO', 'GEO']],
  ['ABE', ['AGRI', 'BIO', 'ECON']],
  // 05: MUSIC
  ['MuArL', ['MUS', 'ARA', 'ENG']],
  ['FaLMu', ['FAK', 'ENG', 'MUS']],
  ['FLMu', ['FRE', 'ENG', 'MUS']],
  ['KLMu', ['KISW', 'ENG', 'MUS']],
  ['LChMu', ['ENG', 'CHI', 'MUS']],
  // 06: SPORTS
  ['BNS', ['BIO', 'FHN', 'SPO']],
  ['SArL', ['SPO', 'ARA', 'ENG']],
  ['FaLS', ['FAK', 'ENG', 'SPO']],
  ['FLS', ['FRE', 'ENG', 'SPO']],
  ['KLS', ['KISW', 'ENG', 'SPO']],
  ['LChS', ['ENG', 'CHI', 'SPO']],
  // 07: ARTS
  ['KLT', ['KISW', 'ENG', 'THEA']],
  ['KFT', ['KISW', 'FRE', 'THEA']],
  ['FaLT', ['FAK', 'ENG', 'THEA']],
  ['KLiT', ['KISW', 'LIT', 'THEA']],
  ['KFMu', ['KISW', 'FRE', 'MUS']],
  ['KLiMu', ['KISW', 'LIT', 'MUS']],
  ['KLFi', ['KISW', 'ENG', 'FIA']],
  ['KFFi', ['KISW', 'FRE', 'FIA']],
  ['FaLFi', ['FAK', 'ENG', 'FIA']],
  ['KLiFi', ['KISW', 'LIT', 'FIA']],
  ['KTeFi', ['KISW', 'TGC', 'FIA']],
  ['LTeFi', ['ENG', 'TGC', 'FIA']],
  ['ArTeFi', ['ARA', 'TGC', 'FIA']],
  ['ChiTeFi', ['CHI', 'TGC', 'FIA']],
  // 08: RELIGIOUS
  ['IHG', ['IKN', 'HIST', 'GEO']],
  ['IHAr', ['IKN', 'HIST', 'ARA']],
  ['IHL', ['IKN', 'HIST', 'ENG']],
  ['IHK', ['IKN', 'HIST', 'KISW']],
  ['DHG', ['DIV', 'HIST', 'GEO']],
  ['DHL', ['DIV', 'HIST', 'ENG']],
  ['DHK', ['DIV', 'HIST', 'KISW']],
  ['DKL', ['DIV', 'KISW', 'ENG']],
  // 09: TOURISM
  ['GTK', ['GEO', 'TOUR', 'KISW']],
  ['GTL', ['GEO', 'TOUR', 'ENG']],
  ['GTF', ['GEO', 'TOUR', 'FRE']],
  ['GTAr', ['GEO', 'TOUR', 'ARA']],
  ['GTChi', ['GEO', 'TOUR', 'CHI']],
  ['HTK', ['HIST', 'TOUR', 'KISW']],
  ['HTL', ['HIST', 'TOUR', 'ENG']],
  ['HTF', ['HIST', 'TOUR', 'FRE']],
  ['HTA', ['HIST', 'TOUR', 'ARA']],
  ['HTC', ['HIST', 'TOUR', 'CHI']],
  ['TLF', ['TOUR', 'ENG', 'FRE']]
];

const COMBINATIONS = COMBINATION_DEFS.map(([code, keys]) => ({
  code,
  name: keys.map(k => SUBJECTS[k].name).join(', '),
  subjects: keys.map(k => `A-${k}`)
}));

function toLevelList(levels) {
  return Array.isArray(levels) ? levels : String(levels || 'O_LEVEL').split(',');
}

function ensureLevelClasses(schoolId, levels) {
  const added = [];
  for (const level of toLevelList(levels)) {
    for (const c of LEVEL_CLASSES[level] || []) {
      const existing = db.get(
        `SELECT id FROM classes WHERE school_id = ? AND name = ?`,
        [schoolId, c.name]
      );
      if (existing) continue;
      const res = db.run(
        `INSERT INTO classes (school_id, form_level, name, numeric_order, level_type)
         VALUES (?, ?, ?, ?, ?)`,
        [schoolId, c.level, c.name, c.order, level]
      );
      const classId = Number(res.lastInsertRowid);
      for (const streamName of ['Stream A', 'Stream B', 'Stream C', 'Stream D']) {
        db.run(
          `INSERT INTO streams (school_id, class_id, name) VALUES (?, ?, ?)`,
          [schoolId, classId, streamName]
        );
      }
      added.push(c.name);
    }
  }
  return added;
}

function ensureSubject(schoolId, s, levelType) {
  const existing = db.get(
    `SELECT id FROM subjects WHERE school_id = ? AND code = ?`,
    [schoolId, s.code]
  );
  const isCore = (s.core === false || s.role === 'SUBSIDIARY') ? 0 : 1;

  if (existing) {
    // A-Level catalog is system-defined: keep name, category and role in sync.
    if (levelType === 'A_LEVEL') {
      db.run(
        `UPDATE subjects SET name = ?, category = ?, is_core = ?, a_level_role = ? WHERE id = ?`,
        [s.name, s.category, isCore, s.role || null, existing.id]
      );
    }
    return existing.id;
  }

  const res = db.run(
    `INSERT INTO subjects (school_id, code, name, is_core, is_active, level_type, category, a_level_role)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
    [schoolId, s.code, s.name, isCore, levelType, s.category, s.role || null]
  );
  return Number(res.lastInsertRowid);
}

// A school with O-Level but no O-Level subjects copies the subject list of the
// school that has the most O-Level subjects, or uses the default list.
function ensureOLevelSubjects(schoolId) {
  const has = db.get(
    `SELECT COUNT(*) AS n FROM subjects WHERE school_id = ? AND level_type = 'O_LEVEL'`,
    [schoolId]
  ).n;
  if (has > 0) return;

  const template = db.get(
    `SELECT school_id FROM subjects
     WHERE level_type = 'O_LEVEL' AND school_id != ?
     GROUP BY school_id ORDER BY COUNT(*) DESC, school_id ASC LIMIT 1`,
    [schoolId]
  );
  const rows = template
    ? db.all(
        `SELECT code, name, is_core, category FROM subjects
         WHERE school_id = ? AND level_type = 'O_LEVEL' ORDER BY code`,
        [template.school_id]
      )
    : DEFAULT_OLEVEL_SUBJECTS.map(s => ({ ...s, is_core: 1 }));

  for (const r of rows) {
    db.run(
      `INSERT OR IGNORE INTO subjects (school_id, code, name, is_core, is_active, level_type, category)
       VALUES (?, ?, ?, ?, 1, 'O_LEVEL', ?)`,
      [schoolId, r.code, r.name, r.is_core, r.category]
    );
  }
}

function ensureCombinations(schoolId, subjectIds) {
  for (const c of COMBINATIONS) {
    let combo = db.get(
      `SELECT id, name FROM combinations WHERE school_id = ? AND code = ?`,
      [schoolId, c.code]
    );
    if (!combo) {
      const res = db.run(
        `INSERT INTO combinations (school_id, code, name) VALUES (?, ?, ?)`,
        [schoolId, c.code, c.name]
      );
      combo = { id: Number(res.lastInsertRowid), name: c.name };
    } else if (combo.name !== c.name) {
      db.run(`UPDATE combinations SET name = ? WHERE id = ?`, [c.name, combo.id]);
    }

    const wanted = c.subjects.map(code => subjectIds[code]);
    const marks = wanted.map(() => '?').join(',');
    db.run(
      `DELETE FROM combination_subjects
       WHERE combination_id = ? AND subject_id NOT IN (${marks})`,
      [combo.id, ...wanted]
    );
    for (const subjectId of wanted) {
      db.run(
        `INSERT OR IGNORE INTO combination_subjects (combination_id, subject_id) VALUES (?, ?)`,
        [combo.id, subjectId]
      );
    }
  }
}

function ensureLevelSubjects(schoolId, levels) {
  const list = toLevelList(levels);

  if (list.includes('O_LEVEL')) {
    ensureOLevelSubjects(schoolId);
    for (const s of OLEVEL_EXTRA_SUBJECTS) ensureSubject(schoolId, s, 'O_LEVEL');
  }

  if (list.includes('PRIMARY')) {
    for (const s of PRIMARY_SUBJECTS) ensureSubject(schoolId, s, 'PRIMARY');
  }

  if (list.includes('A_LEVEL')) {
    const ids = {};
    for (const s of A_LEVEL_SUBJECTS) ids[s.code] = ensureSubject(schoolId, s, 'A_LEVEL');
    ensureCombinations(schoolId, ids);
  }
}

function ensureLevelSetup(schoolId, levels) {
  const list = toLevelList(levels);
  const classes = ensureLevelClasses(schoolId, list);
  ensureLevelSubjects(schoolId, list);
  return classes;
}

function getCombinations(schoolId) {
  const combos = db.all(
    `SELECT id, code, name, is_active FROM combinations WHERE school_id = ? ORDER BY code ASC`,
    [schoolId]
  );
  const links = db.all(
    `SELECT cs.combination_id, s.id AS subject_id, s.code, s.name
     FROM combination_subjects cs
     JOIN subjects s ON s.id = cs.subject_id
     WHERE s.school_id = ?
     ORDER BY s.name ASC`,
    [schoolId]
  );
  return combos.map(c => ({
    ...c,
    subjects: links
      .filter(l => l.combination_id === c.id)
      .map(l => ({ id: l.subject_id, code: l.code, name: l.name }))
  }));
}

module.exports = {
  LEVEL_CLASSES,
  COMBINATIONS,
  ensureLevelClasses,
  ensureLevelSubjects,
  ensureLevelSetup,
  getCombinations
};