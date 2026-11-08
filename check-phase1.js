const db = require('./db/database');
const usersSql = db.get(`SELECT sql FROM sqlite_master WHERE name='users'`).sql;
console.log('Roles mpya zipo:', usersSql.includes('ACADEMIC_ASSISTANT'));
console.log('Safu za shule:', db.all('PRAGMA table_info(schools)').map(c => c.name).join(', '));
console.log('Idadi ya watumiaji:', db.get('SELECT COUNT(*) AS n FROM users').n);
console.log('Idadi ya walimu:', db.get('SELECT COUNT(*) AS n FROM teachers').n);