-- ====================================================================
-- MR LOGIC SCHOOL SYSTEM - Comprehensive Multi-School Database Schema
-- Designed for Tanzania Secondary Schools (Forms 1 - 4) with NECTA
-- ====================================================================

-- 1. Schools (Multi-Tenant Core)
CREATE TABLE IF NOT EXISTS schools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    registration_number TEXT UNIQUE,
    motto TEXT,
    address TEXT,
    region TEXT NOT NULL,
    district TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    logo_url TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users (Role-Based Access)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    phone TEXT,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACADEMIC_MASTER', 'TEACHER')),
    is_active INTEGER NOT NULL DEFAULT 1,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- 3. Academic Years
CREATE TABLE IF NOT EXISTS academic_years (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    year_label TEXT NOT NULL, -- e.g., '2026'
    start_date DATE,
    end_date DATE,
    is_current INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    UNIQUE (school_id, year_label)
);

-- 4. Academic Terms
CREATE TABLE IF NOT EXISTS academic_terms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    academic_year_id INTEGER NOT NULL,
    term_name TEXT NOT NULL, -- e.g., 'Term 1', 'Term 2'
    start_date DATE,
    end_date DATE,
    is_current INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
    UNIQUE (school_id, academic_year_id, term_name)
);

-- 5. Classes (Form 1 - Form 4)
CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    form_level INTEGER NOT NULL CHECK(form_level BETWEEN 1 AND 6),
    name TEXT NOT NULL, -- e.g., 'Form 1', 'Form 2', 'Form 3', 'Form 4'
    numeric_order INTEGER NOT NULL,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    UNIQUE (school_id, name)
);

-- 6. Streams
CREATE TABLE IF NOT EXISTS streams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    name TEXT NOT NULL, -- e.g., 'Stream A', 'Stream B'
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    UNIQUE (school_id, class_id, name)
);

-- 7. Subjects (Tanzanian CSEE O-Level Syllabus)
CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    code TEXT NOT NULL, -- e.g., 'B/MATH', 'ENG', 'KISW', 'BIO', 'CHEM', 'PHY', 'HIST', 'GEO', 'CIV'
    name TEXT NOT NULL,
    is_core INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    UNIQUE (school_id, code)
);

-- 8. Teachers
CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    user_id INTEGER UNIQUE,
    staff_id TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    gender TEXT CHECK(gender IN ('M', 'F')),
    phone TEXT,
    email TEXT,
    qualification TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'ON_LEAVE', 'RESIGNED')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (school_id, staff_id)
);

-- 9. Teacher Subject & Stream Allocations
CREATE TABLE IF NOT EXISTS teacher_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    teacher_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    stream_id INTEGER,
    academic_year_id INTEGER NOT NULL,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (stream_id) REFERENCES streams(id) ON DELETE SET NULL,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE
);

-- 10. Students
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    reg_number TEXT NOT NULL,
    first_name TEXT NOT NULL,
    middle_name TEXT,
    last_name TEXT NOT NULL,
    gender TEXT NOT NULL CHECK(gender IN ('M', 'F')),
    date_of_birth DATE,
    admission_date DATE,
    current_class_id INTEGER NOT NULL,
    current_stream_id INTEGER,
    parent_name TEXT,
    parent_phone TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'GRADUATED', 'TRANSFERRED', 'SUSPENDED')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (current_class_id) REFERENCES classes(id) ON DELETE RESTRICT,
    FOREIGN KEY (current_stream_id) REFERENCES streams(id) ON DELETE SET NULL,
    UNIQUE (school_id, reg_number)
);

-- 11. Student Enrollments per Year
CREATE TABLE IF NOT EXISTS student_enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    academic_year_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    stream_id INTEGER,
    roll_number INTEGER,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (stream_id) REFERENCES streams(id) ON DELETE SET NULL,
    UNIQUE (school_id, student_id, academic_year_id)
);

-- 12. Grading Systems (NECTA Standard vs School Custom)
CREATE TABLE IF NOT EXISTS grading_systems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 1,
    min_subjects_required INTEGER NOT NULL DEFAULT 7,
    points_calculation_method TEXT NOT NULL DEFAULT 'BEST_7' CHECK(points_calculation_method IN ('BEST_7', 'ALL', 'CORE_AND_BEST')),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- 13. Grading Scale Rules (A, B, C, D, F)
CREATE TABLE IF NOT EXISTS grading_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grading_system_id INTEGER NOT NULL,
    grade TEXT NOT NULL,
    min_score REAL NOT NULL,
    max_score REAL NOT NULL,
    points INTEGER NOT NULL,
    remark TEXT NOT NULL,
    gpa_point REAL NOT NULL,
    FOREIGN KEY (grading_system_id) REFERENCES grading_systems(id) ON DELETE CASCADE
);

-- 14. NECTA Division Rules (Div I, II, III, IV, 0)
CREATE TABLE IF NOT EXISTS division_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grading_system_id INTEGER NOT NULL,
    division TEXT NOT NULL,
    min_points INTEGER NOT NULL,
    max_points INTEGER NOT NULL,
    criteria_notes TEXT,
    FOREIGN KEY (grading_system_id) REFERENCES grading_systems(id) ON DELETE CASCADE
);

-- 15. Examinations
CREATE TABLE IF NOT EXISTS examinations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    academic_year_id INTEGER NOT NULL,
    term_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    name TEXT NOT NULL, -- e.g., 'Form 4 Mock Examination 2026'
    exam_type TEXT NOT NULL CHECK(exam_type IN ('MIDTERM', 'TERMINAL', 'ANNUAL', 'MOCK', 'PRE_NECTA', 'MONTHLY')),
    start_date DATE,
    end_date DATE,
    is_locked INTEGER NOT NULL DEFAULT 0, -- Locked by Academic Master to prevent edits
    grading_system_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT,
    FOREIGN KEY (term_id) REFERENCES academic_terms(id) ON DELETE RESTRICT,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT,
    FOREIGN KEY (grading_system_id) REFERENCES grading_systems(id) ON DELETE SET NULL
);

-- 16. Examination Marks
CREATE TABLE IF NOT EXISTS exam_marks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    examination_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    marks REAL, -- Nullable if student is absent
    grade TEXT,
    points INTEGER,
    remarks TEXT,
    is_absent INTEGER NOT NULL DEFAULT 0,
    entered_by_user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (examination_id) REFERENCES examinations(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (entered_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (examination_id, student_id, subject_id)
);

-- 17. Processed Examination Results (Official NECTA Broadsheet Summary)
CREATE TABLE IF NOT EXISTS exam_processed_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    examination_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    total_marks REAL NOT NULL DEFAULT 0,
    average_marks REAL NOT NULL DEFAULT 0,
    gpa REAL NOT NULL DEFAULT 0,
    subjects_sat INTEGER NOT NULL DEFAULT 0,
    subjects_passed INTEGER NOT NULL DEFAULT 0,
    best_seven_points INTEGER NOT NULL DEFAULT 0,
    division TEXT NOT NULL, -- 'I', 'II', 'III', 'IV', '0'
    class_rank INTEGER,
    stream_rank INTEGER,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (examination_id) REFERENCES examinations(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE (examination_id, student_id)
);

-- 18. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for lightning fast queries across multi-tenant data
CREATE INDEX IF NOT EXISTS idx_users_school ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_students_school_class ON students(school_id, current_class_id);
CREATE INDEX IF NOT EXISTS idx_students_reg ON students(school_id, reg_number);
CREATE INDEX IF NOT EXISTS idx_marks_exam_student ON exam_marks(examination_id, student_id);
CREATE INDEX IF NOT EXISTS idx_marks_exam_subject ON exam_marks(examination_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_processed_exam_rank ON exam_processed_results(examination_id, class_rank);
