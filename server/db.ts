import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';

const dbPath = path.resolve(process.cwd(), 'smart_erp.db');
export const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function calculateAttendanceMetrics(
  presentCount: number,
  totalCount: number,
  lectureDurationMinutes = 60
) {
  if (totalCount === 0) {
    return {
      present: 0,
      absent: 0,
      total: 0,
      percentage: 100,
      belowThreshold: false,
      requiredClasses: 0,
      requiredHours: 0,
      safeMargin: 0,
    };
  }
  const percentage = Number(((presentCount / totalCount) * 100).toFixed(1));
  const belowThreshold = percentage < 75;
  const requiredClasses = belowThreshold
    ? Math.max(0, Math.ceil((0.75 * totalCount - presentCount) / 0.25))
    : 0;
  const requiredHours = Number(((requiredClasses * lectureDurationMinutes) / 60).toFixed(1));
  const safeMargin = !belowThreshold
    ? Math.max(0, Math.floor((presentCount - 0.75 * totalCount) / 0.75))
    : 0;

  return {
    present: presentCount,
    absent: totalCount - presentCount,
    total: totalCount,
    percentage,
    belowThreshold,
    requiredClasses,
    requiredHours,
    safeMargin,
  };
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'teacher', 'student')),
      full_name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      duration_years INTEGER NOT NULL DEFAULT 4
    );

    CREATE TABLE IF NOT EXISTS semesters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      number INTEGER NOT NULL,
      label TEXT NOT NULL,
      division TEXT NOT NULL DEFAULT 'A',
      UNIQUE(course_id, number, division)
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      student_code TEXT NOT NULL UNIQUE,
      roll_number TEXT NOT NULL,
      department_id INTEGER NOT NULL REFERENCES departments(id),
      course_id INTEGER NOT NULL REFERENCES courses(id),
      semester_id INTEGER NOT NULL REFERENCES semesters(id),
      batch_year INTEGER NOT NULL DEFAULT 2026
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      teacher_code TEXT NOT NULL UNIQUE,
      department_id INTEGER NOT NULL REFERENCES departments(id),
      designation TEXT NOT NULL DEFAULT 'Assistant Professor',
      specialization TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      department_id INTEGER NOT NULL REFERENCES departments(id),
      semester_id INTEGER NOT NULL REFERENCES semesters(id),
      credits INTEGER NOT NULL DEFAULT 4,
      lecture_duration_minutes INTEGER NOT NULL DEFAULT 60
    );

    CREATE TABLE IF NOT EXISTS teacher_subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      academic_term TEXT NOT NULL DEFAULT '2026-Odd',
      UNIQUE(teacher_id, subject_id)
    );

    CREATE TABLE IF NOT EXISTS student_subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(student_id, subject_id)
    );

    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      room_code TEXT DEFAULT '',
      topic TEXT DEFAULT 'Regular Lecture',
      session_date TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 60,
      expires_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('active', 'closed')) DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('present', 'absent')),
      marked_method TEXT NOT NULL CHECK(marked_method IN ('qr_scan', 'manual')) DEFAULT 'qr_scan',
      marked_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by_user_id INTEGER REFERENCES users(id),
      updated_at TEXT,
      UNIQUE(session_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS attendance_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
      session_id INTEGER NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      previous_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      changed_by_user_id INTEGER NOT NULL REFERENCES users(id),
      reason TEXT DEFAULT '',
      changed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('Academic', 'Exam', 'Event', 'Urgent')) DEFAULT 'Academic',
      target_role TEXT NOT NULL CHECK(target_role IN ('all', 'student', 'teacher')) DEFAULT 'all',
      author_id INTEGER NOT NULL REFERENCES users(id),
      published_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
      from_date TEXT NOT NULL,
      to_date TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
      reviewed_by_teacher_id INTEGER REFERENCES teachers(id),
      review_note TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS timetable (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      day_of_week TEXT NOT NULL CHECK(day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      room TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_attendance_records_student_subject ON attendance_records(student_id, subject_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_sessions_token ON attendance_sessions(token);
    CREATE INDEX IF NOT EXISTS idx_attendance_sessions_subject ON attendance_sessions(subject_id);
  `);

  const userCountRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCountRow.count === 0) {
    seedDatabase();
  }
}

function seedDatabase() {
  const defaultHash = hashPassword('password123');

  // 1. Departments
  const insertDept = db.prepare('INSERT INTO departments (code, name) VALUES (?, ?)');
  const cseId = Number(insertDept.run('CSE', 'Computer Science & Engineering').lastInsertRowid);
  const eceId = Number(insertDept.run('ECE', 'Electronics & Communication').lastInsertRowid);

  // 2. Courses
  const insertCourse = db.prepare('INSERT INTO courses (department_id, code, name, duration_years) VALUES (?, ?, ?, ?)');
  const btechCsId = Number(insertCourse.run(cseId, 'BTECH-CS', 'B.Tech Computer Science', 4).lastInsertRowid);
  const btechEcId = Number(insertCourse.run(eceId, 'BTECH-EC', 'B.Tech Electronics', 4).lastInsertRowid);

  // 3. Semesters
  const insertSem = db.prepare('INSERT INTO semesters (course_id, number, label, division) VALUES (?, ?, ?, ?)');
  const sem5AId = Number(insertSem.run(btechCsId, 5, 'Semester 5', 'A').lastInsertRowid);
  const sem5BId = Number(insertSem.run(btechCsId, 5, 'Semester 5', 'B').lastInsertRowid);
  const sem3ECId = Number(insertSem.run(btechEcId, 3, 'Semester 3', 'A').lastInsertRowid);

  // 4. Users: Admin
  const insertUser = db.prepare(`
    INSERT INTO users (login_id, email, password_hash, role, full_name, phone, avatar_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const adminUserId = Number(
    insertUser.run(
      'ADM-001',
      'admin@smarterp.edu',
      defaultHash,
      'admin',
      'Dr. Eleanor Vance',
      '+1 (555) 210-4400',
      '/src/assets/images/avatar_admin_dean_1794899747880.jpg'
    ).lastInsertRowid
  );

  // 5. Teachers
  const insertTeacher = db.prepare(`
    INSERT INTO teachers (user_id, teacher_code, department_id, designation, specialization)
    VALUES (?, ?, ?, ?, ?)
  `);

  const t1UserId = Number(
    insertUser.run(
      'TCH-101',
      'priya.nair@smarterp.edu',
      defaultHash,
      'teacher',
      'Prof. Priya Nair',
      '+1 (555) 318-7701',
      '/src/assets/images/avatar_teacher_prof_1794899748510.jpg'
    ).lastInsertRowid
  );
  const teacher1Id = Number(
    insertTeacher.run(t1UserId, 'TCH-101', cseId, 'Associate Professor', 'Operating Systems & Distributed Computing')
      .lastInsertRowid
  );

  const t2UserId = Number(
    insertUser.run(
      'TCH-102',
      'marcus.chen@smarterp.edu',
      defaultHash,
      'teacher',
      'Prof. Marcus Chen',
      '+1 (555) 318-7702',
      ''
    ).lastInsertRowid
  );
  const teacher2Id = Number(
    insertTeacher.run(t2UserId, 'TCH-102', cseId, 'Assistant Professor', 'Database Systems & Computer Networks')
      .lastInsertRowid
  );

  // 6. Students
  const insertStudent = db.prepare(`
    INSERT INTO students (user_id, student_code, roll_number, department_id, course_id, semester_id, batch_year)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const studentDefs = [
    {
      loginId: 'STU-2026-001',
      email: 'aarav.mehta@smarterp.edu',
      name: 'Aarav Mehta',
      roll: 'CS24-001',
      phone: '+1 (555) 890-1001',
      avatar: '/src/assets/images/avatar_student_scholar_1794899750755.jpg',
      semId: sem5AId,
    },
    {
      loginId: 'STU-2026-002',
      email: 'maya.lin@smarterp.edu',
      name: 'Maya Lin',
      roll: 'CS24-002',
      phone: '+1 (555) 890-1002',
      avatar: '',
      semId: sem5AId,
    },
    {
      loginId: 'STU-2026-003',
      email: 'rohan.kulkarni@smarterp.edu',
      name: 'Rohan Kulkarni',
      roll: 'CS24-003',
      phone: '+1 (555) 890-1003',
      avatar: '',
      semId: sem5AId,
    },
    {
      loginId: 'STU-2026-004',
      email: 'sofia.alvarez@smarterp.edu',
      name: 'Sofia Alvarez',
      roll: 'CS24-004',
      phone: '+1 (555) 890-1004',
      avatar: '',
      semId: sem5AId,
    },
    {
      loginId: 'STU-2026-005',
      email: 'kabir.sharma@smarterp.edu',
      name: 'Kabir Sharma',
      roll: 'CS24-005',
      phone: '+1 (555) 890-1005',
      avatar: '',
      semId: sem5AId,
    },
    {
      loginId: 'STU-2026-006',
      email: 'zara.patel@smarterp.edu',
      name: 'Zara Patel',
      roll: 'CS24-006',
      phone: '+1 (555) 890-1006',
      avatar: '',
      semId: sem5AId,
    },
  ];

  const studentIds: number[] = [];
  for (const s of studentDefs) {
    const uid = Number(
      insertUser.run(s.loginId, s.email, defaultHash, 'student', s.name, s.phone, s.avatar).lastInsertRowid
    );
    const sid = Number(insertStudent.run(uid, s.loginId, s.roll, cseId, btechCsId, s.semId, 2026).lastInsertRowid);
    studentIds.push(sid);
  }

  // Keep unused variables referenced cleanly
  void sem5BId;
  void sem3ECId;

  // 7. Subjects
  const insertSubj = db.prepare(`
    INSERT INTO subjects (code, name, department_id, semester_id, credits, lecture_duration_minutes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const cs501Id = Number(insertSubj.run('CS501', 'Operating Systems', cseId, sem5AId, 4, 60).lastInsertRowid);
  const cs502Id = Number(insertSubj.run('CS502', 'Database Management Systems', cseId, sem5AId, 4, 60).lastInsertRowid);
  const cs503Id = Number(insertSubj.run('CS503', 'Computer Networks', cseId, sem5AId, 4, 60).lastInsertRowid);
  const cs504Id = Number(insertSubj.run('CS504', 'Software Engineering', cseId, sem5AId, 3, 60).lastInsertRowid);

  // 8. Assign Teachers to Subjects
  const assignTeacher = db.prepare(
    'INSERT INTO teacher_subjects (teacher_id, subject_id, academic_term) VALUES (?, ?, ?)'
  );
  assignTeacher.run(teacher1Id, cs501Id, '2026-Odd');
  assignTeacher.run(teacher1Id, cs504Id, '2026-Odd');
  assignTeacher.run(teacher2Id, cs502Id, '2026-Odd');
  assignTeacher.run(teacher2Id, cs503Id, '2026-Odd');

  // 9. Enroll all 6 students into all 4 Semester 5A subjects
  const enrollStudent = db.prepare('INSERT INTO student_subjects (student_id, subject_id) VALUES (?, ?)');
  const allSubjects = [cs501Id, cs502Id, cs503Id, cs504Id];
  for (const sid of studentIds) {
    for (const subId of allSubjects) {
      enrollStudent.run(sid, subId);
    }
  }

  // 10. Seed Historical Attendance Sessions & Records
  // Specifically configure CS501 (40 sessions) so STU-2026-001 (Aarav) has 25/40 = 62.5% (needs 20 classes!)
  const insertSession = db.prepare(`
    INSERT INTO attendance_sessions (subject_id, teacher_id, token, topic, session_date, duration_seconds, expires_at, status, created_at, closed_at)
    VALUES (?, ?, ?, ?, ?, 60, ?, 'closed', ?, ?)
  `);
  const insertRecord = db.prepare(`
    INSERT INTO attendance_records (session_id, student_id, subject_id, status, marked_method, marked_at)
    VALUES (?, ?, ?, ?, 'qr_scan', ?)
  `);

  const seedSubjectHistory = (
    subjectId: number,
    teacherId: number,
    totalLectures: number,
    aaravPresentCount: number,
    topics: string[]
  ) => {
    const baseDate = new Date('2026-09-01T09:00:00Z');
    for (let i = 0; i < totalLectures; i++) {
      const lectureDate = new Date(baseDate.getTime() + i * 2 * 24 * 60 * 60 * 1000);
      const dateStr = lectureDate.toISOString().slice(0, 10);
      const tsStr = lectureDate.toISOString();
      const token = crypto.randomBytes(16).toString('hex');
      const topic = topics[i % topics.length];
      const sessionId = Number(
        insertSession.run(subjectId, teacherId, token, topic, dateStr, tsStr, tsStr, tsStr).lastInsertRowid
      );

      studentIds.forEach((sid, idx) => {
        let isPresent = false;
        if (idx === 0) {
          // Aarav Mehta exact count
          isPresent = i < aaravPresentCount;
        } else if (idx === 1) {
          // Maya Lin ~92%
          isPresent = i % 12 !== 5;
        } else if (idx === 2) {
          // Rohan ~70% (also below 75% on some subjects)
          isPresent = i % 10 < 7;
        } else if (idx === 3) {
          // Sofia ~85%
          isPresent = i % 7 !== 3;
        } else if (idx === 4) {
          // Kabir ~78%
          isPresent = i % 9 < 7;
        } else {
          // Zara ~90%
          isPresent = i % 10 !== 4;
        }
        insertRecord.run(sessionId, sid, subjectId, isPresent ? 'present' : 'absent', tsStr);
      });
    }
  };

  seedSubjectHistory(cs501Id, teacher1Id, 40, 25, [
    'Process Scheduling & Threads',
    'Deadlock Avoidance & Bankers Algorithm',
    'Virtual Memory & Paging',
    'File System Internals',
  ]);
  seedSubjectHistory(cs502Id, teacher2Id, 32, 28, [
    'Relational Algebra & Normalization',
    'B+ Tree Indexing',
    'ACID Transactions & Concurrency',
    'Query Optimization',
  ]);
  seedSubjectHistory(cs503Id, teacher2Id, 28, 20, [
    'TCP Congestion Control',
    'IPv4 Subnetting & CIDR',
    'OSPF & BGP Routing',
    'TLS Handshake & DNS',
  ]);
  seedSubjectHistory(cs504Id, teacher1Id, 24, 21, [
    'Agile Sprints & Estimation',
    'Architectural Trade-offs',
    'Automated Integration Testing',
    'CI/CD Release Pipelines',
  ]);

  // 11. Timetable
  const insertTT = db.prepare(`
    INSERT INTO timetable (subject_id, teacher_id, semester_id, day_of_week, start_time, end_time, room)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const ttEntries = [
    [cs501Id, teacher1Id, sem5AId, 'Monday', '09:00', '10:00', 'LH-204'],
    [cs502Id, teacher2Id, sem5AId, 'Monday', '10:15', '11:15', 'LH-204'],
    [cs503Id, teacher2Id, sem5AId, 'Tuesday', '09:00', '10:00', 'Lab-3B'],
    [cs504Id, teacher1Id, sem5AId, 'Tuesday', '11:30', '12:30', 'LH-108'],
    [cs501Id, teacher1Id, sem5AId, 'Wednesday', '09:00', '10:00', 'LH-204'],
    [cs503Id, teacher2Id, sem5AId, 'Wednesday', '14:00', '15:00', 'LH-204'],
    [cs502Id, teacher2Id, sem5AId, 'Thursday', '10:15', '11:15', 'Lab-2A'],
    [cs504Id, teacher1Id, sem5AId, 'Friday', '09:00', '10:00', 'LH-108'],
    [cs501Id, teacher1Id, sem5AId, 'Friday', '11:30', '12:30', 'LH-204'],
    [cs502Id, teacher2Id, sem5AId, 'Saturday', '10:00', '11:00', 'LH-204'],
  ];
  for (const row of ttEntries) {
    insertTT.run(...row);
  }

  // 12. Notices
  const insertNotice = db.prepare(`
    INSERT INTO notices (title, content, category, target_role, author_id, published_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertNotice.run(
    '75% Minimum Attendance Requirement Before Mid-Semester Exams',
    'Students with cumulative or subject-wise attendance below 75% must clear their deficit before November 30 to remain eligible for end-semester practicals and examinations.',
    'Urgent',
    'student',
    adminUserId,
    '2026-11-12T08:30:00Z'
  );
  insertNotice.run(
    'End-Semester Examination Schedule Published',
    'Theory examinations for Semester 5 B.Tech CSE begin December 8. Seating charts and hall tickets will be released one week prior.',
    'Exam',
    'all',
    adminUserId,
    '2026-11-14T10:00:00Z'
  );
  insertNotice.run(
    'Faculty Grade Moderation & Attendance Audit Deadline',
    'All teaching faculty are requested to close open QR attendance sessions and verify manual corrections by Friday 5:00 PM.',
    'Academic',
    'teacher',
    adminUserId,
    '2026-11-15T14:15:00Z'
  );

  // 13. Leave Requests
  const insertLeave = db.prepare(`
    INSERT INTO leave_requests (student_id, subject_id, from_date, to_date, reason, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertLeave.run(
    studentIds[0],
    cs501Id,
    '2026-11-18',
    '2026-11-19',
    'Representing the department at the Regional Systems Hackathon.',
    'pending',
    '2026-11-15T09:20:00Z'
  );
  insertLeave.run(
    studentIds[2],
    cs502Id,
    '2026-11-10',
    '2026-11-10',
    'Medical consultation with signed clinic slip.',
    'approved',
    '2026-11-09T11:00:00Z'
  );
}
