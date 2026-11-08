/**
 * MR LOGIC SCHOOL SYSTEM - Teacher Management Service
 * Redesigned for streamlined staff registration, automatic username generation,
 * multi-subject & class/stream allocation, and strict school isolation.
 */
const db = require('../db/database');
const { hashPassword } = require('./authService');

// TEMP: remove after the controlled teacher-registration diagnostic.
const TEACHER_REGISTRATION_SQL_DIAGNOSTICS = true;

function runTeacherSqlDiagnostic(enabled, operation, params, execute) {
  if (!enabled) return execute();

  try {
    return execute();
  } catch (error) {
    const parameterTypes = params.map((value, index) => {
      let type = typeof value;
      if (value === null) type = 'null';
      else if (Array.isArray(value)) type = 'array';
      return { position: index + 1, type };
    });
    const errorCode = typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code)
      ? error.code
      : null;
    const stackFrames = typeof error?.stack === 'string'
      ? error.stack.split('\n').slice(1).join('\n')
      : null;

    console.error('[TEMP teacher registration SQL diagnostic]', {
      operation,
      parameterTypes,
      errorName: error?.name || typeof error,
      errorCode,
      stack: stackFrames
    });
    throw error;
  }
}

/**
 * Generate unique uppercase username from teacher's first name and surname.
 * Example: JULIUS SOMALIA IMELI -> JULIUSIMELI
 * If JULIUSIMELI exists, appends number (JULIUSIMELI1, JULIUSIMELI2...)
 */
function generateUniqueUsername(fullName, schoolId = null, excludeUserId = null, diagnostics = false) {
  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
    return '';
  }

  // Strip honorary titles (e.g. Mwl., Mr., Mrs., Ms., Dr., Tr.)
  let cleanName = fullName.replace(/^(mwl\.?|mr\.?|mrs\.?|ms\.?|dr\.?|tr\.?)\s+/i, '').trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';

  const firstName = parts[0].replace(/[^a-zA-Z0-9]/g, '');
  const lastName = parts.length > 1 ? parts[parts.length - 1].replace(/[^a-zA-Z0-9]/g, '') : '';
  const baseUsername = (firstName + lastName).toUpperCase();

  if (!baseUsername) return 'TEACHER';

  let candidate = baseUsername;
  let counter = 1;

  while (true) {
    let checkSql = `SELECT id FROM users WHERE UPPER(username) = ?`;
    const params = [candidate];
    if (excludeUserId) {
      checkSql += ` AND id != ?`;
      params.push(excludeUserId);
    }
    const existing = runTeacherSqlDiagnostic(
      diagnostics,
      'teacher.create.username_lookup',
      params,
      () => db.get(checkSql, params)
    );
    if (!existing) {
      return candidate;
    }
    candidate = `${baseUsername}${counter}`;
    counter++;
  }
}

function getTeachers(schoolId) {
  const teachers = db.all(
    `SELECT t.id, t.school_id, t.user_id, t.staff_id, t.first_name, t.last_name, 
            t.gender, t.phone, t.status, t.created_at,
            u.username, u.role
     FROM teachers t
     LEFT JOIN users u ON t.user_id = u.id AND u.school_id = t.school_id
     WHERE t.school_id = ?
     ORDER BY t.id ASC`,
    [schoolId]
  );

  const allocations = db.all(
    `SELECT a.id as allocation_id, a.teacher_id, a.subject_id, a.class_id, a.stream_id,
            s.code as subject_code, s.name as subject_name,
            c.name as class_name, c.form_level,
            st.name as stream_name
     FROM teacher_allocations a
     JOIN subjects s ON a.subject_id = s.id AND s.school_id = a.school_id
     JOIN classes c ON a.class_id = c.id AND c.school_id = a.school_id
     LEFT JOIN streams st ON a.stream_id = st.id
       AND st.school_id = a.school_id AND st.class_id = a.class_id
     WHERE a.school_id = ?`,
    [schoolId]
  );

  return teachers.map((t, idx) => {
    const teacherAllocations = allocations.filter(a => a.teacher_id === t.id);

    // Extract unique subjects
    const subjectMap = new Map();
    for (const a of teacherAllocations) {
      if (!subjectMap.has(a.subject_id)) {
        subjectMap.set(a.subject_id, {
          id: a.subject_id,
          code: a.subject_code,
          name: a.subject_name
        });
      }
    }

    // Extract unique class/stream assignments
    const classMap = new Map();
    for (const a of teacherAllocations) {
      const key = `${a.class_id}_${a.stream_id || 0}`;
      if (!classMap.has(key)) {
        classMap.set(key, {
          classId: a.class_id,
          className: a.class_name,
          streamId: a.stream_id,
          streamName: a.stream_name || 'All Streams',
          label: a.stream_name ? `${a.class_name} - ${a.stream_name}` : a.class_name
        });
      }
    }

    const fullName = `${t.first_name} ${t.last_name}`.trim();

    return {
      ...t,
      sn: idx + 1,
      fullName,
      subjects: Array.from(subjectMap.values()),
      assignedClasses: Array.from(classMap.values()),
      allocations: teacherAllocations
    };
  });
}

function getTeacherById(schoolId, teacherId, diagnostics = false) {
  const teacherSql = `SELECT t.id, t.school_id, t.user_id, t.staff_id, t.first_name, t.last_name, 
            t.gender, t.phone, t.status, t.created_at,
            u.username, u.role
     FROM teachers t
     LEFT JOIN users u ON t.user_id = u.id AND u.school_id = t.school_id
     WHERE t.id = ? AND t.school_id = ?`;
  const teacherParams = [teacherId, schoolId];
  const teacher = runTeacherSqlDiagnostic(
    diagnostics,
    'teacher.create.result_lookup',
    teacherParams,
    () => db.get(teacherSql, teacherParams)
  );

  if (!teacher) return null;

  const allocationsSql = `SELECT a.id as allocation_id, a.teacher_id, a.subject_id, a.class_id, a.stream_id,
            s.code as subject_code, s.name as subject_name,
            c.name as class_name, c.form_level,
            st.name as stream_name
     FROM teacher_allocations a
     JOIN subjects s ON a.subject_id = s.id AND s.school_id = a.school_id
     JOIN classes c ON a.class_id = c.id AND c.school_id = a.school_id
     LEFT JOIN streams st ON a.stream_id = st.id
       AND st.school_id = a.school_id AND st.class_id = a.class_id
     WHERE a.teacher_id = ? AND a.school_id = ?`;
  const allocationsParams = [teacherId, schoolId];
  const allocations = runTeacherSqlDiagnostic(
    diagnostics,
    'teacher.create.result_allocations_lookup',
    allocationsParams,
    () => db.all(allocationsSql, allocationsParams)
  );

  const subjectMap = new Map();
  for (const a of allocations) {
    if (!subjectMap.has(a.subject_id)) {
      subjectMap.set(a.subject_id, {
        id: a.subject_id,
        code: a.subject_code,
        name: a.subject_name
      });
    }
  }

  const classMap = new Map();
  for (const a of allocations) {
    const key = `${a.class_id}_${a.stream_id || 0}`;
    if (!classMap.has(key)) {
      classMap.set(key, {
        classId: a.class_id,
        className: a.class_name,
        streamId: a.stream_id,
        streamName: a.stream_name || 'All Streams',
        label: a.stream_name ? `${a.class_name} - ${a.stream_name}` : a.class_name
      });
    }
  }

  return {
    ...teacher,
    fullName: `${teacher.first_name} ${teacher.last_name}`.trim(),
    subjects: Array.from(subjectMap.values()),
    assignedClasses: Array.from(classMap.values()),
    allocations
  };
}

function createTeacher(schoolId, data) {
  const {
    fullName,
    firstName: explicitFirst,
    lastName: explicitLast,
    gender,
    phone,
    username: customUsername,
    password,
    subjectIds = [],
    classAllocations = []
  } = data;

  const rawName = (fullName || `${explicitFirst || ''} ${explicitLast || ''}`).trim();
  if (!rawName) {
    throw new Error('FULL NAME is required to register a teacher.');
  }

  // Parse first and last names
  let cleanName = rawName.replace(/^(mwl\.?|mr\.?|mrs\.?|ms\.?|dr\.?|tr\.?)\s+/i, '').trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  const firstName = explicitFirst || parts[0] || 'Teacher';
  const lastName = explicitLast || (parts.length > 1 ? parts.slice(1).join(' ') : parts[0] || 'Staff');

  if (!gender || !['M', 'F'].includes(gender)) {
    throw new Error('GENDER is required and must be either Male (M) or Female (F).');
  }

  // Generate or sanitize username
  let targetUsername = customUsername ? customUsername.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
  if (!targetUsername) {
    targetUsername = generateUniqueUsername(rawName, schoolId, null, TEACHER_REGISTRATION_SQL_DIAGNOSTICS);
  } else {
    // If admin supplied a custom username, ensure it doesn't collide
    const usernameParams = [targetUsername];
    const existing = runTeacherSqlDiagnostic(
      TEACHER_REGISTRATION_SQL_DIAGNOSTICS,
      'teacher.create.custom_username_lookup',
      usernameParams,
      () => db.get(`SELECT id FROM users WHERE UPPER(username) = ?`, usernameParams)
    );
    if (existing) {
      targetUsername = generateUniqueUsername(
        targetUsername,
        schoolId,
        null,
        TEACHER_REGISTRATION_SQL_DIAGNOSTICS
      );
    }
  }

  // Fetch school details for default email domain
  const schoolParams = [schoolId];
  const school = runTeacherSqlDiagnostic(
    TEACHER_REGISTRATION_SQL_DIAGNOSTICS,
    'teacher.create.school_lookup',
    schoolParams,
    () => db.get(`SELECT * FROM schools WHERE id = ?`, schoolParams)
  );
  if (!school) {
    throw new Error('School not found.');
  }

  const schoolCode = school.code ? school.code.toLowerCase().replace(/[^a-z0-9]/g, '') : 'sch';
  const systemEmail = `${targetUsername.toLowerCase()}@${schoolCode}.mrlogic.tz`;

  // Fetch current academic year
  const currentYearParams = [schoolId];
  const currentYear = runTeacherSqlDiagnostic(
    TEACHER_REGISTRATION_SQL_DIAGNOSTICS,
    'teacher.create.current_academic_year_lookup',
    currentYearParams,
    () => db.get(
      `SELECT id FROM academic_years WHERE school_id = ? AND is_current = 1 LIMIT 1`,
      currentYearParams
    )
  ) || runTeacherSqlDiagnostic(
    TEACHER_REGISTRATION_SQL_DIAGNOSTICS,
    'teacher.create.latest_academic_year_lookup',
    currentYearParams,
    () => db.get(
      `SELECT id FROM academic_years WHERE school_id = ? ORDER BY id DESC LIMIT 1`,
      currentYearParams
    )
  );

  return db.transaction(() => {
    // 1. Create User account for Teacher Login
    const defaultPassword = password || 'Teacher123!';
    const auth = hashPassword(defaultPassword);

    const userSql = `INSERT INTO users (school_id, full_name, email, username, phone, password_hash, salt, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'TEACHER')`;
    const userParams = [
      schoolId,
      `Mwl. ${firstName} ${lastName}`.trim(),
      systemEmail,
      targetUsername,
      phone ? phone.trim() : null,
      auth.hash,
      auth.salt
    ];
    const userRes = runTeacherSqlDiagnostic(
      TEACHER_REGISTRATION_SQL_DIAGNOSTICS,
      'teacher.create.user_insert',
      userParams,
      () => db.run(userSql, userParams)
    );
    const userId = userRes.lastInsertRowid;

    // 2. Generate unique internal staff identifier
    const countParams = [schoolId];
    const countRow = runTeacherSqlDiagnostic(
      TEACHER_REGISTRATION_SQL_DIAGNOSTICS,
      'teacher.create.staff_sequence_lookup',
      countParams,
      () => db.get(`SELECT COUNT(*) as count FROM teachers WHERE school_id = ?`, countParams)
    );
    const nextSeq = (countRow ? countRow.count : 0) + 1;
    const internalStaffId = `TCH-${schoolId}-${Date.now().toString().slice(-4)}-${nextSeq}`;

    // 3. Create Teacher Record
    const teacherSql = `INSERT INTO teachers (school_id, user_id, staff_id, first_name, last_name, gender, phone, email, qualification, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'ACTIVE')`;
    const teacherParams = [
      schoolId,
      userId,
      internalStaffId,
      firstName.trim(),
      lastName.trim(),
      gender,
      phone ? phone.trim() : null
    ];
    const teacherRes = runTeacherSqlDiagnostic(
      TEACHER_REGISTRATION_SQL_DIAGNOSTICS,
      'teacher.create.teacher_insert',
      teacherParams,
      () => db.run(teacherSql, teacherParams)
    );
    const teacherId = teacherRes.lastInsertRowid;

    // 4. Save Subject & Class Allocations
    if (currentYear) {
      saveTeacherAllocations(
        schoolId,
        teacherId,
        currentYear.id,
        subjectIds,
        classAllocations,
        TEACHER_REGISTRATION_SQL_DIAGNOSTICS
      );
    }

    return getTeacherById(schoolId, teacherId, TEACHER_REGISTRATION_SQL_DIAGNOSTICS);
  });
}

function updateTeacher(schoolId, teacherId, data) {
  const teacher = getTeacherById(schoolId, teacherId);
  if (!teacher) {
    throw new Error('Teacher not found or unauthorized.');
  }
  if (teacher.user_id && teacher.role !== 'TEACHER') {
    throw new Error('Only teacher accounts may be modified through teacher management.');
  }

  const {
    fullName,
    firstName: explicitFirst,
    lastName: explicitLast,
    gender,
    phone,
    username: customUsername,
    status,
    subjectIds,
    classAllocations
  } = data;

  const rawName = (fullName || `${explicitFirst || teacher.first_name} ${explicitLast || teacher.last_name}`).trim();
  let cleanName = rawName.replace(/^(mwl\.?|mr\.?|mrs\.?|ms\.?|dr\.?|tr\.?)\s+/i, '').trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  const firstName = explicitFirst || parts[0] || teacher.first_name;
  const lastName = explicitLast || (parts.length > 1 ? parts.slice(1).join(' ') : teacher.last_name);

  return db.transaction(() => {
    // Handle username update if requested
    let targetUsername = teacher.username;
    if (customUsername && customUsername.trim().toUpperCase() !== teacher.username) {
      targetUsername = generateUniqueUsername(customUsername.trim(), schoolId, teacher.user_id);
    }

    // Update User Record if exists
    if (teacher.user_id) {
      db.run(
        `UPDATE users SET 
           full_name = ?,
           username = ?,
           phone = COALESCE(?, phone)
         WHERE id = ? AND school_id = ?`,
        [
          `Mwl. ${firstName} ${lastName}`.trim(),
          targetUsername,
          phone ? phone.trim() : null,
          teacher.user_id,
          schoolId
        ]
      );
    }

    // Update Teacher Record
    db.run(
      `UPDATE teachers SET
         first_name = ?,
         last_name = ?,
         gender = COALESCE(?, gender),
         phone = COALESCE(?, phone),
         status = COALESCE(?, status)
       WHERE id = ? AND school_id = ?`,
      [
        firstName.trim(),
        lastName.trim(),
        gender || null,
        phone !== undefined ? (phone ? phone.trim() : null) : null,
        status || null,
        teacherId,
        schoolId
      ]
    );

    // Update Allocations if provided
    if (subjectIds !== undefined || classAllocations !== undefined) {
      const currentYear = db.get(
        `SELECT id FROM academic_years WHERE school_id = ? AND is_current = 1 LIMIT 1`,
        [schoolId]
      ) || db.get(
        `SELECT id FROM academic_years WHERE school_id = ? ORDER BY id DESC LIMIT 1`,
        [schoolId]
      );

      if (currentYear) {
        db.run(`DELETE FROM teacher_allocations WHERE teacher_id = ? AND school_id = ?`, [teacherId, schoolId]);
        saveTeacherAllocations(
          schoolId,
          teacherId,
          currentYear.id,
          subjectIds || teacher.subjects.map(s => s.id),
          classAllocations || teacher.assignedClasses.map(c => `${c.classId}_${c.streamId || ''}`)
        );
      }
    }

    return getTeacherById(schoolId, teacherId);
  });
}

function deleteTeacher(schoolId, teacherId) {
  const teacher = getTeacherById(schoolId, teacherId);
  if (!teacher) {
    throw new Error('Teacher not found or unauthorized.');
  }
  if (teacher.user_id && teacher.role !== 'TEACHER') {
    throw new Error('Only teacher accounts may be deleted through teacher management.');
  }

  return db.transaction(() => {
    db.run(`DELETE FROM teacher_allocations WHERE teacher_id = ? AND school_id = ?`, [teacherId, schoolId]);
    db.run(`DELETE FROM teachers WHERE id = ? AND school_id = ?`, [teacherId, schoolId]);
    if (teacher.user_id) {
      db.run(`DELETE FROM users WHERE id = ? AND school_id = ?`, [teacher.user_id, schoolId]);
    }
    return { success: true, message: 'Teacher deleted successfully.' };
  });
}

/**
 * Helper to record teacher allocations across multiple subjects and classes/streams
 */
function saveTeacherAllocations(
  schoolId,
  teacherId,
  academicYearId,
  subjectIds = [],
  classAllocations = [],
  diagnostics = false
) {
  if (!Array.isArray(subjectIds) || !Array.isArray(classAllocations)) {
    throw new Error('Teacher allocations must be submitted as lists.');
  }
  if (subjectIds.length === 0) return;

  const teacherParams = [teacherId, schoolId];
  const teacher = runTeacherSqlDiagnostic(
    diagnostics,
    'teacher.create.allocation_teacher_lookup',
    teacherParams,
    () => db.get(`SELECT id FROM teachers WHERE id = ? AND school_id = ?`, teacherParams)
  );
  const yearParams = [academicYearId, schoolId];
  const year = runTeacherSqlDiagnostic(
    diagnostics,
    'teacher.create.allocation_year_lookup',
    yearParams,
    () => db.get(`SELECT id FROM academic_years WHERE id = ? AND school_id = ?`, yearParams)
  );
  if (!teacher || !year) {
    throw new Error('Teacher and academic year must belong to this school.');
  }

  const numericSubjectIds = [...new Set(subjectIds.map(subjectId => parseInt(subjectId, 10)))];
  if (numericSubjectIds.some(subjectId => !Number.isSafeInteger(subjectId) || subjectId < 1)) {
    throw new Error('Teacher subject allocations must use valid subject IDs.');
  }
  for (const subjectId of numericSubjectIds) {
    const subjectParams = [subjectId, schoolId];
    if (!runTeacherSqlDiagnostic(
      diagnostics,
      'teacher.create.allocation_subject_lookup',
      subjectParams,
      () => db.get(`SELECT id FROM subjects WHERE id = ? AND school_id = ?`, subjectParams)
    )) {
      throw new Error('Teacher subject allocations must belong to this school.');
    }
  }

  const allocationSql = `
    INSERT INTO teacher_allocations (school_id, teacher_id, subject_id, class_id, stream_id, academic_year_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const insertStmt = runTeacherSqlDiagnostic(
    diagnostics,
    'teacher.create.allocation_prepare',
    [],
    () => db.prepare(allocationSql)
  );

  // Parse class/stream items. They can be "{ classId, streamId }" objects or "classId_streamId" strings
  const parsedClasses = [];
  for (const item of classAllocations) {
    if (typeof item === 'object' && item !== null) {
      parsedClasses.push({
        classId: parseInt(item.classId, 10),
        streamId: item.streamId ? parseInt(item.streamId, 10) : null
      });
    } else if (typeof item === 'string') {
      const [cStr, sStr] = item.split('_');
      const cId = parseInt(cStr, 10);
      const sId = sStr && sStr !== '0' && sStr !== '' ? parseInt(sStr, 10) : null;
      if (!Number.isSafeInteger(cId) || cId < 1 ||
          (sId !== null && (!Number.isSafeInteger(sId) || sId < 1))) {
        throw new Error('Teacher class allocations must use valid class and stream IDs.');
      }
      parsedClasses.push({ classId: cId, streamId: sId });
    } else {
      throw new Error('Teacher class allocations must use valid class and stream IDs.');
    }
  }

  // If no classes specified, link subjects to default class (Form 1)
  if (parsedClasses.length === 0) {
    const defaultClassParams = [schoolId];
    const defaultClass = runTeacherSqlDiagnostic(
      diagnostics,
      'teacher.create.default_class_lookup',
      defaultClassParams,
      () => db.get(`SELECT id FROM classes WHERE school_id = ? LIMIT 1`, defaultClassParams)
    );
    if (defaultClass) {
      parsedClasses.push({ classId: defaultClass.id, streamId: null });
    }
  }

  for (const allocation of parsedClasses) {
    const classParams = [allocation.classId, schoolId];
    const classRecord = runTeacherSqlDiagnostic(
      diagnostics,
      'teacher.create.allocation_class_lookup',
      classParams,
      () => db.get(`SELECT id FROM classes WHERE id = ? AND school_id = ?`, classParams)
    );
    if (!classRecord) {
      throw new Error('Teacher class allocations must belong to this school.');
    }
    if (allocation.streamId !== null) {
      const streamParams = [allocation.streamId, schoolId, allocation.classId];
      const stream = runTeacherSqlDiagnostic(
        diagnostics,
        'teacher.create.allocation_stream_lookup',
        streamParams,
        () => db.get(
          `SELECT id FROM streams WHERE id = ? AND school_id = ? AND class_id = ?`,
          streamParams
        )
      );
      if (!stream) {
        throw new Error('Teacher stream allocations must belong to the selected class and school.');
      }
    }
  }

  // Cross-product allocation: each subject to each allocated class/stream
  for (const numericSubId of numericSubjectIds) {
    for (const ca of parsedClasses) {
      const allocationParams = [
        schoolId,
        teacherId,
        numericSubId,
        ca.classId,
        ca.streamId || null,
        academicYearId
      ];
      runTeacherSqlDiagnostic(
        diagnostics,
        'teacher.create.allocation_insert',
        allocationParams,
        () => insertStmt.run(...allocationParams)
      );
    }
  }
}

module.exports = {
  generateUniqueUsername,
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  deleteTeacher
};
