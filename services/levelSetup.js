const db = require('../db/database');

const LEVEL_CLASSES = {
  PRIMARY: [1, 2, 3, 4, 5, 6, 7].map(n => ({ level: n, name: `Standard ${n}`, order: n - 8 })),
  O_LEVEL: [1, 2, 3, 4].map(n => ({ level: n, name: `Form ${n}`, order: n })),
  A_LEVEL: [5, 6].map(n => ({ level: n, name: `Form ${n}`, order: n }))
};

const DEFAULT_OLEVEL_SUBJECTS = [
  { code: 'B/MATH', name: 'Basic Mathematics', category: 'SCIENCE' }, { code: 'ENG', name: 'English Language', category: 'ARTS' },
  { code: 'KISW', name: 'Kiswahili', category: 'ARTS' }, { code: 'BIO', name: 'Biology', category: 'SCIENCE' },
  { code: 'CHEM', name: 'Chemistry', category: 'SCIENCE' }, { code: 'PHY', name: 'Physics', category: 'SCIENCE' },
  { code: 'HIST', name: 'History', category: 'ARTS' }, { code: 'GEO', name: 'Geography', category: 'ARTS' },
  { code: 'CIV', name: 'Civics', category: 'ARTS' }, { code: 'BKPG', name: 'Bookkeeping', category: 'BUSINESS' },
  { code: 'COMM', name: 'Commerce', category: 'BUSINESS' }
];

const SUBJECTS = {
  PHY: { name: 'Physics', category: 'SCIENCE' }, CHEM: { name: 'Chemistry', category: 'SCIENCE' }, BIO: { name: 'Biology', category: 'SCIENCE' },
  AMATH: { name: 'Advanced Mathematics', category: 'SCIENCE' }, CS: { name: 'Computer Science', category: 'SCIENCE' }, AGRI: { name: 'Agriculture', category: 'SCIENCE' },
  FHN: { name: 'Food and Human Nutrition', category: 'SCIENCE' }, ICT: { name: 'ICT', category: 'SCIENCE' }, COMP: { name: 'Computer Studies', category: 'SCIENCE' },
  GEO: { name: 'Geography', category: 'ARTS' }, HIST: { name: 'History', category: 'ARTS' }, KISW: { name: 'Kiswahili', category: 'ARTS' },
  ENG: { name: 'English Language', category: 'ARTS' }, LIT: { name: 'Literature in English', category: 'ARTS' }, FAK: { name: 'Fasihi ya Kiswahili', category: 'ARTS' },
  FRE: { name: 'French', category: 'ARTS' }, ARA: { name: 'Arabic', category: 'ARTS' }, CHI: { name: 'Chinese', category: 'ARTS' },
  MUS: { name: 'Music', category: 'ARTS' }, SPO: { name: 'Sports', category: 'ARTS' }, THEA: { name: 'Theatre Arts', category: 'ARTS' },
  FIA: { name: 'Fine Arts', category: 'ARTS' }, TGC: { name: 'Textile and Garment Construction', category: 'ARTS' }, TOUR: { name: 'Tourism', category: 'ARTS' },
  IKN: { name: 'Islamic Knowledge', category: 'ARTS' }, DIV: { name: 'Divinity', category: 'ARTS' }, HTM: { name: 'Historia ya Tanzania na Maadili', category: 'ARTS' },
  ECON: { name: 'Economics', category: 'BUSINESS' }, BUS: { name: 'Business Studies', category: 'BUSINESS' }, ACC: { name: 'Accountancy', category: 'BUSINESS' },
  AC: { name: 'Academic Communication', category: 'GENERAL' }, BAM: { name: 'Basic Applied Mathematics', category: 'GENERAL' }
};

const OLEVEL_EXTRA_KEYS = ['HTM', 'BUS', 'FAK', 'THEA', 'FIA', 'AGRI', 'ICT', 'COMP', 'LIT', 'FRE', 'ARA', 'CHI', 'IKN', 'DIV', 'FHN', 'MUS', 'SPO', 'TGC'];
const OLEVEL_EXTRA_SUBJECTS = OLEVEL_EXTRA_KEYS.map(k => ({ code: k, name: SUBJECTS[k].name, category: SUBJECTS[k].category, core: false }));

const PRIMARY_SUBJECTS = [
  { code: 'P-KISW', name: 'Kiswahili', category: 'GENERAL' }, { code: 'P-ENG', name: 'English Language', category: 'GENERAL' },
  { code: 'P-MAARIFA', name: 'Maarifa ya Jamii', category: 'GENERAL' }, { code: 'P-HESABU', name: 'Hisabati', category: 'GENERAL' },
  { code: 'P-SAYANSI', name: 'Sayansi na Teknolojia', category: 'GENERAL' }, { code: 'P-URAIA', name: 'Uraia na Maadili', category: 'GENERAL' }
];

const A_LEVEL_PRINCIPAL_KEYS = ['PHY', 'CHEM', 'BIO', 'AMATH', 'CS', 'AGRI', 'FHN', 'GEO', 'HIST', 'KISW', 'ENG', 'LIT', 'FAK', 'FRE', 'ARA', 'CHI', 'MUS', 'SPO', 'THEA', 'FIA', 'TGC', 'TOUR', 'IKN', 'DIV', 'ECON', 'BUS', 'ACC'];
const A_LEVEL_SUBSIDIARY_KEYS = ['AC', 'BAM', 'HTM'];

const A_LEVEL_SUBJECTS = [
  ...A_LEVEL_PRINCIPAL_KEYS.map(k => ({ code: `A-${k}`, name: SUBJECTS[k].name, category: SUBJECTS[k].category, role: 'PRINCIPAL' })),
  ...A_LEVEL_SUBSIDIARY_KEYS.map(k => ({ code: `A-${k}`, name: SUBJECTS[k].name, category: 'GENERAL', role: 'SUBSIDIARY' }))
];

const COMBINATION_DEFS = [
  ['HGK', ['HIST', 'GEO', 'KISW']], ['HGL', ['HIST', 'GEO', 'ENG']], ['HGF', ['HIST', 'GEO', 'FRE']], ['HKL', ['HIST', 'KISW', 'ENG']], ['HGE', ['HIST', 'GEO', 'ECON']], ['HGAr', ['HIST', 'GEO', 'ARA']], ['HGCh', ['HIST', 'GEO', 'CHI']], ['HGFa', ['HIST', 'GEO', 'FAK']], ['HGLi', ['HIST', 'GEO', 'LIT']], ['KLF', ['KISW', 'ENG', 'FRE']], ['KLAr', ['KISW', 'ENG', 'ARA']], ['KLCh', ['KISW', 'ENG', 'CHI']], ['KArCh', ['KISW', 'ARA', 'CHI']], ['KArF', ['KISW', 'ARA', 'FRE']], ['LFAr', ['ENG', 'FRE', 'ARA']], ['LFCh', ['ENG', 'FRE', 'CHI']], ['FArCh', ['FRE', 'ARA', 'CHI']], ['HLF', ['HIST', 'ENG', 'FRE']], ['HLAr', ['HIST', 'ENG', 'ARA']], ['BuLF', ['BUS', 'ENG', 'FRE']], ['FLE', ['FRE', 'ENG', 'ECON']], ['HLCh', ['HIST', 'ENG', 'CHI']], ['EBuAc', ['ECON', 'BUS', 'ACC']], ['EGM', ['ECON', 'GEO', 'AMATH']], ['ECsM', ['ECON', 'CS', 'AMATH']], ['BuAcCs', ['BUS', 'ACC', 'CS']], ['BuAcM', ['BUS', 'ACC', 'AMATH']], ['EBuI', ['ECON', 'BUS', 'IKN']], ['EBuD', ['ECON', 'BUS', 'DIV']], ['MEBu', ['AMATH', 'ECON', 'BUS']], ['BuEL', ['BUS', 'ECON', 'ENG']], ['BuEChi', ['BUS', 'ECON', 'CHI']], ['BuEAr', ['BUS', 'ECON', 'ARA']], ['BuEF', ['BUS', 'ECON', 'FRE']], ['PCM', ['PHY', 'CHEM', 'AMATH']], ['PCB', ['PHY', 'CHEM', 'BIO']], ['PGM', ['PHY', 'GEO', 'AMATH']], ['PMCs', ['PHY', 'AMATH', 'CS']], ['CBA', ['CHEM', 'BIO', 'AGRI']], ['CBN', ['CHEM', 'BIO', 'FHN']], ['CBG', ['CHEM', 'BIO', 'GEO']], ['ABE', ['AGRI', 'BIO', 'ECON']], ['MuArL', ['MUS', 'ARA', 'ENG']], ['FaLMu', ['FAK', 'ENG', 'MUS']], ['FLMu', ['FRE', 'ENG', 'MUS']], ['KLMu', ['KISW', 'ENG', 'MUS']], ['LChMu', ['ENG', 'CHI', 'MUS']], ['BNS', ['BIO', 'FHN', 'SPO']], ['SArL', ['SPO', 'ARA', 'ENG']], ['FaLS', ['FAK', 'ENG', 'SPO']], ['FLS', ['FRE', 'ENG', 'SPO']], ['KLS', ['KISW', 'ENG', 'SPO']], ['LChS', ['ENG', 'CHI', 'SPO']], ['KLT', ['KISW', 'ENG', 'THEA']], ['KFT', ['KISW', 'FRE', 'THEA']], ['FaLT', ['FAK', 'ENG', 'THEA']], ['KLiT', ['KISW', 'LIT', 'THEA']], ['KFMu', ['KISW', 'FRE', 'MUS']], ['KLiMu', ['KISW', 'LIT', 'MUS']], ['KLFi', ['KISW', 'ENG', 'FIA']], ['KFFi', ['KISW', 'FRE', 'FIA']], ['FaLFi', ['FAK', 'ENG', 'FIA']], ['KLiFi', ['KISW', 'LIT', 'FIA']], ['KTeFi', ['KISW', 'TGC', 'FIA']], ['LTeFi', ['ENG', 'TGC', 'FIA']], ['ArTeFi', ['ARA', 'TGC', 'FIA']], ['ChiTeFi', ['CHI', 'TGC', 'FIA']], ['IHG', ['IKN', 'HIST', 'GEO']], ['IHAr', ['IKN', 'HIST', 'ARA']], ['IHL', ['IKN', 'HIST', 'ENG']], ['IHK', ['IKN', 'HIST', 'KISW']], ['DHG', ['DIV', 'HIST', 'GEO']], ['DHL', ['DIV', 'HIST', 'ENG']], ['DHK', ['DIV', 'HIST', 'KISW']], ['DKL', ['DIV', 'KISW', 'ENG']], ['GTK', ['GEO', 'TOUR', 'KISW']], ['GTL', ['GEO', 'TOUR', 'ENG']], ['GTF', ['GEO', 'TOUR', 'FRE']], ['GTAr', ['GEO', 'TOUR', 'ARA']], ['GTChi', ['GEO', 'TOUR', 'CHI']], ['HTK', ['HIST', 'TOUR', 'KISW']], ['HTL', ['HIST', 'TOUR', 'ENG']], ['HTF', ['HIST', 'TOUR', 'FRE']], ['HTA', ['HIST', 'TOUR', 'ARA']], ['HTC', ['HIST', 'TOUR', 'CHI']], ['TLF', ['TOUR', 'ENG', 'FRE']]
];

const COMBINATIONS = COMBINATION_DEFS.map(([code, keys]) => ({ code, name: keys.map(k => SUBJECTS[k].name).join(', '), subjects: keys.map(k => `A-${k}`) }));

// HII NDIO FUNCTION ILIYOKOSEKANA
function toLevelList(levels) { 
    return Array.isArray(levels) ? levels : String(levels || 'O_LEVEL').split(','); 
}

async function ensureLevelSetup(schoolId, levels) {
  const list = toLevelList(levels);
  
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

  if (list.includes('O_LEVEL')) {
    const has = await db.get(`SELECT COUNT(*) AS n FROM subjects WHERE school_id = ? AND level_type = 'O_LEVEL'`, [schoolId]);
    if (has.n == 0) {
      const template = await db.get(`SELECT school_id FROM subjects WHERE level_type = 'O_LEVEL' AND school_id != ? GROUP BY school_id ORDER BY COUNT(*) DESC LIMIT 1`, [schoolId]);
      const rows = template ? await db.all(`SELECT code, name, is_core, category FROM subjects WHERE school_id = ? AND level_type = 'O_LEVEL'`, [template.school_id]) : DEFAULT_OLEVEL_SUBJECTS.map(s => ({ ...s, is_core: 1 }));
      for (const r of rows) {
        await db.run(`INSERT INTO subjects (school_id, code, name, is_core, is_active, level_type, category) VALUES (?, ?, ?, ?, 1, 'O_LEVEL', ?)`, [schoolId, r.code, r.name, r.is_core, r.category]);
      }
    }
    for (const s of OLEVEL_EXTRA_SUBJECTS) {
        const ex = await db.get(`SELECT id FROM subjects WHERE school_id = ? AND code = ?`, [schoolId, s.code]);
        if(!ex) await db.run(`INSERT INTO subjects (school_id, code, name, is_core, is_active, level_type, category) VALUES (?, ?, ?, ?, 1, 'O_LEVEL', ?)`, [schoolId, s.code, s.name, 0, s.category]);
    }
  }

  if (list.includes('PRIMARY')) {
    for (const s of PRIMARY_SUBJECTS) {
        const ex = await db.get(`SELECT id FROM subjects WHERE school_id = ? AND code = ?`, [schoolId, s.code]);
        if(!ex) await db.run(`INSERT INTO subjects (school_id, code, name, is_core, is_active, level_type, category) VALUES (?, ?, ?, ?, 1, 'PRIMARY', ?)`, [schoolId, s.code, s.name, 1, s.category]);
    }
  }

  return createdClassesCount;
}

module.exports = { ensureLevelSetup };