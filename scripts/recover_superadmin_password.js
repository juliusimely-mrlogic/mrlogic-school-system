const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const projectRoot = path.resolve(__dirname, '..');
const databasePath = path.join(projectRoot, 'data', 'mr_logic.db');
const backupPath = path.join(projectRoot, 'data', 'mr_logic_before_superadmin_recovery.db');

function assertBackupExists() {
  try {
    if (!fs.statSync(backupPath).isFile()) {
      throw new Error();
    }
  } catch {
    throw new Error('Required database backup was not found; no changes were made.');
  }
}

function validateBackup() {
  let backupDatabase;
  try {
    backupDatabase = new DatabaseSync(backupPath, { readOnly: true });

    const integrityResults = backupDatabase.prepare('PRAGMA integrity_check').all();
    if (integrityResults.length !== 1 ||
        integrityResults[0].integrity_check !== 'ok') {
      throw new Error('Backup integrity check failed; no changes were made.');
    }

    const usersTable = backupDatabase.prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name = ?`
    ).get('users');
    if (!usersTable) {
      throw new Error('Backup does not contain the users table; no changes were made.');
    }

    assertTargetAccount(backupDatabase);
  } finally {
    if (backupDatabase) {
      backupDatabase.close();
    }
  }
}

function assertTargetAccount(database) {
  const account = database.prepare(
    'SELECT id, username, role FROM users WHERE id = ?'
  ).get(1);

  if (!account || account.id !== 1 || account.username !== 'superadmin' ||
      account.role !== 'SUPER_ADMIN') {
    throw new Error('Target account identity check failed; no changes were made.');
  }
}

function promptHidden(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    return Promise.reject(new Error('A secure interactive terminal is required.'));
  }

  return new Promise((resolve, reject) => {
    let value = '';
    let settled = false;
    const wasRaw = process.stdin.isRaw;

    const cleanup = () => {
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(wasRaw);
      process.stdin.pause();
      process.stdout.write('\n');
    };

    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(result);
    };

    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003' || character === '\u0004') {
          finish(new Error('Password entry cancelled; no changes were made.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          finish(null, value);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = Array.from(value).slice(0, -1).join('');
        } else {
          value += character;
        }
      }
    };

    process.stdout.write(prompt);
    process.stdin.setEncoding('utf8');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function main() {
  assertBackupExists();
  validateBackup();

  if (!fs.existsSync(databasePath) || !fs.statSync(databasePath).isFile()) {
    throw new Error('The configured project database was not found.');
  }

  const readOnlyDatabase = new DatabaseSync(databasePath, { readOnly: true });
  try {
    assertTargetAccount(readOnlyDatabase);
  } finally {
    readOnlyDatabase.close();
  }

  const password = await promptHidden('New password: ');
  if (Array.from(password).length < 12) {
    throw new Error('Password must be at least 12 characters; no changes were made.');
  }

  const confirmation = await promptHidden('Confirm new password: ');
  const passwordBytes = Buffer.from(password, 'utf8');
  const confirmationBytes = Buffer.from(confirmation, 'utf8');
  if (passwordBytes.length !== confirmationBytes.length ||
      !crypto.timingSafeEqual(passwordBytes, confirmationBytes)) {
    throw new Error('Passwords do not match; no changes were made.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
  const database = new DatabaseSync(databasePath);

  try {
    database.exec('BEGIN IMMEDIATE;');
    try {
      assertTargetAccount(database);
      const result = database.prepare(
        `UPDATE users
         SET password_hash = ?, salt = ?
         WHERE id = ? AND username = ? AND role = ?`
      ).run(passwordHash, salt, 1, 'superadmin', 'SUPER_ADMIN');

      if (result.changes !== 1) {
        throw new Error('Expected exactly one target account update; no changes were committed.');
      }

      database.exec('COMMIT;');
    } catch (error) {
      database.exec('ROLLBACK;');
      throw error;
    }
  } finally {
    database.close();
  }

  console.log('Password updated for the verified Super Administrator account.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
