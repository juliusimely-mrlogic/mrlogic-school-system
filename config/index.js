/**
 * MR LOGIC SCHOOL SYSTEM - System Configuration
 */
const path = require('node:path');

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || Buffer.byteLength(jwtSecret, 'utf8') < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 bytes of secret material.');
}

module.exports = {
  appName: 'MR LOGIC SCHOOL SYSTEM',
  version: '1.0.0',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  jwtSecret,
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'mr_logic.db'),
  isDev: process.env.NODE_ENV !== 'production',
  defaultSchoolId: 1,
  pagination: {
    defaultLimit: 20,
    maxLimit: 100
  }
};
