/**
 * MR LOGIC SCHOOL SYSTEM - Tenant Isolation Middleware
 */
function tenantError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseSchoolId(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return value;
  }
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw tenantError('Invalid school ID.', 400);
  }
  const schoolId = Number(value);
  if (!Number.isSafeInteger(schoolId)) {
    throw tenantError('Invalid school ID.', 400);
  }
  return schoolId;
}

function resolveTenant(req) {
  const headers = req.headers || {};
  const query = req.query || {};
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const selectors = [
    query.school_id,
    body.school_id,
    body.schoolId,
    headers['x-school-id']
  ].filter(value => value !== undefined && value !== null && value !== '');
  const requestedIds = selectors.map(parseSchoolId);

  if (new Set(requestedIds).size > 1) {
    throw tenantError('Conflicting school IDs were supplied.', 400);
  }

  const requestedSchoolId = requestedIds[0] ?? null;
  if (req.user && req.user.role === 'SUPER_ADMIN') {
    return requestedSchoolId;
  }

  const assignedSchoolId = req.user?.school_id;
  if (!Number.isSafeInteger(assignedSchoolId) || assignedSchoolId < 1) {
    throw tenantError('This account is not assigned to a school.', 403);
  }
  if (requestedSchoolId !== null && requestedSchoolId !== assignedSchoolId) {
    throw tenantError('Access to another school is not permitted.', 403);
  }
  return assignedSchoolId;
}

function enforceTenantAccess(req, res, targetSchoolId, next) {
  if (!req.user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Authentication required' }));
    return;
  }

  let schoolId;
  try {
    schoolId = parseSchoolId(targetSchoolId);
  } catch (error) {
    res.writeHead(error.statusCode || 400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
    return;
  }

  if (req.user.role !== 'SUPER_ADMIN' && req.user.school_id !== schoolId) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Access to another school is not permitted.'
    }));
    return;
  }

  next();
}

module.exports = {
  resolveTenant,
  enforceTenantAccess
};
