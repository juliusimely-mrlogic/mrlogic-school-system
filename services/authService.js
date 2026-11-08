const bcrypt = require('bcryptjs');

function hashPassword(password) {
  // Bcrypt inatengeneza salt yenyewe ndani ya hash
  const hash = bcrypt.hashSync(password, 10);
  return { hash, salt: 'bcrypt_internal' }; 
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

module.exports = { hashPassword, verifyPassword };