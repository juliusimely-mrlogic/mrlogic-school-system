/**
 * MR LOGIC SCHOOL SYSTEM - Authentication Middleware
 */
const { verifyToken } = require('../services/authService');
const db = require('../db/database');

const VALID_ROLES = new Set([
  'SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACADEMIC_MASTER', 'ACADEMIC_ASSISTANT',
  'HEAD_TEACHER', 'SCHOOL_MANAGER', 'COUNCIL_ACADEMIC_OFFICER',
  'COUNCIL_EDUCATION_OFFICER', 'TEACHER'
]);

function authenticate(req) {
  // 1. Try Authorization header
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-access-token']) {
    token = req.headers['x-access-token'].trim();
  } else if (req.cookies && req.cookies['mr_logic_token']) {
    token = req.cookies['mr_logic_token'];
  }

  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  // Fetch fresh user record
  const user = db.get(
    `SELECT u.id, u.school_id, u.full_name, u.email, u.username, u.phone, u.role, u.is_active,
            s.name as school_name, s.code as school_code
     FROM users u
     LEFT JOIN schools s ON u.school_id = s.id
     WHERE u.id = ? AND u.is_active = 1`,
    [payload.userId]
  );

  return user && VALID_ROLES.has(user.role) ? user : null;
}

function requireAuth(req, res, next) {
  const user = authenticate(req);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Authentication required. Please log in.' }));
    return;
  }
  req.user = user;
  next();
}

function requireRole(allowedRoles = []) {
  return function (req, res, next) {
    if (!req.user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Authentication required.' }));
      return;
    }

    if (!Array.isArray(allowedRoles) ||
        allowedRoles.length === 0 ||
        !allowedRoles.every(role => VALID_ROLES.has(role)) ||
        !allowedRoles.includes(req.user.role)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Access denied: insufficient permissions for this operation.' }));
      return;
    }

    next();
  };
}

module.exports = {
  authenticate,
  requireAuth,
  requireRole,
  VALID_ROLES
};