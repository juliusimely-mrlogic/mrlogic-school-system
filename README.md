# MR LOGIC SCHOOL SYSTEM & EXAMINATION MANAGEMENT SYSTEM

A professional, modern, responsive, multi-school web-based School Management System and Examination Management System engineered specifically for secondary schools in Tanzania (O-Level Forms 1–4, scalable to A-Level Forms 5–6).

---

## 🌟 Key Features

1. **Multi-School Architecture (Strict Tenant Isolation)**
   - Supports multiple independent schools on a single platform.
   - Each school has isolated students, teachers, classes, streams, subjects, examinations, marks, and reports.
   - School Admin, Academic Master, and Teachers are strictly sandboxed to their own school data.
   - Super Administrator can oversee the entire platform and switch school contexts.

2. **Role-Based Access Control (RBAC)**
   - **SUPER ADMIN**: Platform management, school registration, global oversight.
   - **SCHOOL ADMIN**: School profile, teacher management, student admissions, school calendar.
   - **ACADEMIC MASTER**: Examination sessions, locking/unlocking marks entry, NECTA results processing, broadsheets, student report cards.
   - **TEACHER**: Marks entry for assigned subjects/streams, student performance tracking.

3. **Authentic Tanzanian NECTA O-Level Grading Engine**
   - **Subject Grade Scale**:
     - **A**: 75 – 100% (Points: 1, Distinction / Bora Sana)
     - **B**: 65 – 74.99% (Points: 2, Very Good / Vizuri Sana)
     - **C**: 45 – 64.99% (Points: 3, Good / Vizuri)
     - **D**: 30 – 44.99% (Points: 4, Satisfactory / Wastani)
     - **F**: 0 – 29.99% (Points: 5, Fail / Feli)
   - **Best 7 Subjects Aggregation**: Sums points of candidate's best 7 subjects according to NECTA CSEE rules.
   - **Division Calculation**:
     - **Division I**: 7 to 17 points
     - **Division II**: 18 to 21 points
     - **Division III**: 22 to 25 points
     - **Division IV**: 26 to 33 points (minimum 2 passes required)
     - **Division 0**: 34 to 35 points (or failure to achieve minimum pass criteria)
   - **GPA & Subject GPA**: 1.0 (Class A) to 5.0 (Class F).
   - **Custom Grading Support**: Fully configurable grading rules per school.

4. **Academic & Student Management**
   - Academic Years and Terms (e.g., Year 2026, Term 1 & Term 2).
   - Forms 1 to 4 with multiple streams (Stream A, Stream B, etc.).
   - Tanzanian CSEE syllabus: Basic Mathematics, English, Kiswahili, Biology, Chemistry, Physics, History, Geography, Civics, Commerce, Bookkeeping.
   - Student registration, stream allocation, parent/guardian contact, registration numbers.

5. **Examination Management & Marks Register**
   - Create examinations (Midterm, Terminal, Annual, Mock, Pre-NECTA).
   - Examination locking to protect examination marks from unauthorized alterations.
   - Interactive spreadsheet-style marks entry with live real-time grade & point calculations.
   - One-click NECTA results processing engine.

6. **Reports & Broadsheets**
   - Official School/Class NECTA Broadsheet with all subject scores, points, divisions, and ranks.
   - Printable official individual Student Terminal Progress Report Cards with signature stamps.
   - Subject Performance Analysis ranked by Pass Rate %.

7. **Ultra-Modern Responsive Design**
   - Fully optimized for Android smartphones, tablets, laptops, and desktop computers.
   - Clean, professional UI with modern design tokens, responsive drawer, and mobile bottom navigation.
   - Zero external CDN or paid service dependencies — completely offline-capable and privacy-respecting.

---

## 🛠️ Technology Stack

- **Backend Runtime**: Node.js (v24 LTS native runtime)
- **Database Engine**: SQLite with Write-Ahead Logging (WAL) mode via Node.js native `node:sqlite`
- **Security & Cryptography**: Native `node:crypto` (`scrypt` password hashing + RFC 7519 JWT tokens)
- **Frontend Architecture**: Mobile-First Vanilla HTML5 + CSS3 Design System + Vanilla JS
- **Dependency Philosophy**: 100% Free, Open-Source, and zero external npm package dependencies (runs instantly on any computer without downloading hundreds of megabytes of packages).

---

## 🚀 How to Run the System

### Option 1: Double-click Windows Launcher
Double-click `run-server.bat` in the project root folder.

### Option 2: Command Line
Configure a persistent JWT secret in your Windows user environment before starting the server. This generates 256 bits of random secret material without adding it to the project:
```powershell
$secret = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
[Environment]::SetEnvironmentVariable('JWT_SECRET', $secret, 'User')
$env:JWT_SECRET = $secret
```
For future terminal sessions, reopen the terminal after setting the user environment variable. Keep the same secret across restarts; changing it invalidates existing login sessions. The server refuses to start if `JWT_SECRET` is missing or shorter than 32 bytes.

```powershell
node server.js
```
or via the Antigravity Node wrapper:
```powershell
& "C:\Users\JULIUS\AppData\Roaming\Antigravity\bin\agy-node.cmd" server.js
```

Then open your browser to:
```
http://localhost:3000
```

---

## Verification Tests

The existing `tests/test_system.js` suite seeds and changes its configured SQLite database. Run it only with `DB_PATH` pointed to a dedicated temporary database, never the live school database.

---

## Signing In

Sign in with the username or email address and password already assigned to your account. Existing account records and password hashes are retained. The system no longer signs in automatically or creates seeded demo accounts at server startup. A new, empty database therefore needs administrator accounts provisioned through a secure process before users can sign in.
