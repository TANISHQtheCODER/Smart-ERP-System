import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  calculateAttendanceMetrics,
  db,
  hashPassword,
  initDatabase,
  verifyPassword,
} from './server/db.ts';

initDatabase();

interface AuthUser {
  id: number;
  login_id: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  full_name: string;
  phone: string;
  avatar_url: string;
  student_id: number | null;
  student_code: string | null;
  teacher_id: number | null;
  teacher_code: string | null;
}

interface AuthRequest extends Request {
  user?: AuthUser;
}

const SESSION_COOKIE = 'smart_erp_session';

function getUserById(userId: number): AuthUser | null {
  const row = db
    .prepare(
      `
      SELECT u.id, u.login_id, u.email, u.role, u.full_name, u.phone, u.avatar_url, u.is_active,
             s.id AS student_id, s.student_code,
             t.id AS teacher_id, t.teacher_code
      FROM users u
      LEFT JOIN students s ON s.user_id = u.id
      LEFT JOIN teachers t ON t.user_id = u.id
      WHERE u.id = ?
    `
    )
    .get(userId) as (AuthUser & { is_active: number }) | undefined;

  if (!row || !row.is_active) return null;
  return {
    id: row.id,
    login_id: row.login_id,
    email: row.email,
    role: row.role,
    full_name: row.full_name,
    phone: row.phone,
    avatar_url: row.avatar_url,
    student_id: row.student_id ?? null,
    student_code: row.student_code ?? null,
    teacher_id: row.teacher_id ?? null,
    teacher_code: row.teacher_code ?? null,
  };
}

function getTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieToken = req.cookies?.[SESSION_COOKIE];
  return typeof cookieToken === 'string' && cookieToken.length > 0 ? cookieToken : null;
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const session = db
    .prepare('SELECT user_id, expires_at FROM auth_sessions WHERE token = ?')
    .get(token) as { user_id: number; expires_at: string } | undefined;

  if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
    if (session) {
      db.prepare('DELETE FROM auth_sessions WHERE token = ?').run(token);
    }
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
    return;
  }

  const user = getUserById(session.user_id);
  if (!user) {
    res.status(401).json({ error: 'Account inactive or not found' });
    return;
  }

  req.user = user;
  next();
}

function requireRole(...roles: Array<'admin' | 'teacher' | 'student'>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'You do not have permission to access this resource' });
      return;
    }
    next();
  };
}

function csvEscape(val: unknown): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function getBaseOrigin(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // ==========================================
  // AUTH & PROFILE ROUTES
  // ==========================================
  app.post('/api/auth/login', (req, res) => {
    const { identifier, password } = req.body as { identifier?: string; password?: string };
    const cleanId = (identifier || '').trim();
    if (!cleanId || !password) {
      res.status(400).json({ error: 'Login ID / Email and password are required.' });
      return;
    }

    const row = db
      .prepare('SELECT id, password_hash, is_active FROM users WHERE LOWER(login_id) = LOWER(?) OR LOWER(email) = LOWER(?)')
      .get(cleanId, cleanId) as { id: number; password_hash: string; is_active: number } | undefined;

    if (!row || !verifyPassword(password, row.password_hash)) {
      res.status(401).json({ error: 'Invalid credentials. Please verify your ID/email and password.' });
      return;
    }

    if (!row.is_active) {
      res.status(403).json({ error: 'Account is deactivated. Contact the administrator.' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO auth_sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
      token,
      row.id,
      expiresAt
    );

    const user = getUserById(row.id);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ token, user });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = getTokenFromRequest(req);
    if (token) {
      db.prepare('DELETE FROM auth_sessions WHERE token = ?').run(token);
    }
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
    res.json({ user: req.user });
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    const { login_id, email, new_password } = req.body as {
      login_id?: string;
      email?: string;
      new_password?: string;
    };

    if (!login_id || !email || !new_password || new_password.length < 6) {
      res.status(400).json({
        error: 'Provide your Login ID, registered email, and a new password (min 6 characters).',
      });
      return;
    }

    const user = db
      .prepare('SELECT id FROM users WHERE LOWER(login_id) = LOWER(?) AND LOWER(email) = LOWER(?)')
      .get(login_id.trim(), email.trim()) as { id: number } | undefined;

    if (!user) {
      res.status(404).json({ error: 'No matching account found for that Login ID and email pair.' });
      return;
    }

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(new_password), user.id);
    res.json({ message: 'Password updated successfully. You can now sign in with your new password.' });
  });

  app.get('/api/profile', requireAuth, (req: AuthRequest, res) => {
    const u = req.user!;
    let extra: Record<string, unknown> = {};
    if (u.role === 'student' && u.student_id) {
      extra =
        (db
          .prepare(
            `SELECT s.student_code, s.roll_number, s.batch_year, d.name AS department_name, c.name AS course_name, sem.label AS semester_label, sem.division
             FROM students s
             JOIN departments d ON d.id = s.department_id
             JOIN courses c ON c.id = s.course_id
             JOIN semesters sem ON sem.id = s.semester_id
             WHERE s.id = ?`
          )
          .get(u.student_id) as Record<string, unknown>) || {};
    } else if (u.role === 'teacher' && u.teacher_id) {
      extra =
        (db
          .prepare(
            `SELECT t.teacher_code, t.designation, t.specialization, d.name AS department_name
             FROM teachers t
             JOIN departments d ON d.id = t.department_id
             WHERE t.id = ?`
          )
          .get(u.teacher_id) as Record<string, unknown>) || {};
    }
    res.json({ user: u, details: extra });
  });

  app.put('/api/profile', requireAuth, (req: AuthRequest, res) => {
    const { full_name, phone } = req.body as { full_name?: string; phone?: string };
    if (!full_name || full_name.trim().length < 2) {
      res.status(400).json({ error: 'Full name must be at least 2 characters.' });
      return;
    }
    db.prepare('UPDATE users SET full_name = ?, phone = ? WHERE id = ?').run(
      full_name.trim(),
      (phone || '').trim(),
      req.user!.id
    );
    res.json({ user: getUserById(req.user!.id) });
  });

  app.put('/api/profile/password', requireAuth, (req: AuthRequest, res) => {
    const { current_password, new_password } = req.body as {
      current_password?: string;
      new_password?: string;
    };
    if (!current_password || !new_password || new_password.length < 6) {
      res.status(400).json({ error: 'Current password and new password (min 6 characters) are required.' });
      return;
    }

    const row = db
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .get(req.user!.id) as { password_hash: string };

    if (!verifyPassword(current_password, row.password_hash)) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      hashPassword(new_password),
      req.user!.id
    );
    res.json({ message: 'Password updated successfully.' });
  });

  // ==========================================
  // ADMIN ROUTES
  // ==========================================
  app.get('/api/admin/overview', requireAuth, requireRole('admin'), (_req, res) => {
    const totalStudents = (db.prepare('SELECT COUNT(*) as c FROM students').get() as { c: number }).c;
    const totalTeachers = (db.prepare('SELECT COUNT(*) as c FROM teachers').get() as { c: number }).c;
    const totalSubjects = (db.prepare('SELECT COUNT(*) as c FROM subjects').get() as { c: number }).c;
    const totalSessions = (
      db.prepare('SELECT COUNT(*) as c FROM attendance_sessions').get() as { c: number }
    ).c;

    const overallRow = db
      .prepare(
        `SELECT COUNT(*) as total_records,
                SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_records
         FROM attendance_records`
      )
      .get() as { total_records: number; present_records: number | null };

    const overallPercentage =
      overallRow.total_records > 0
        ? Number((((overallRow.present_records || 0) / overallRow.total_records) * 100).toFixed(1))
        : 100;

    // Students with <75% attendance in at least one enrolled subject
    const enrollmentRows = db
      .prepare(
        `SELECT s.id AS student_id, s.student_code, u.full_name, sub.id AS subject_id, sub.code AS subject_code, sub.name AS subject_name, sub.lecture_duration_minutes,
                COUNT(ar.id) AS total_classes,
                COALESCE(SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END), 0) AS present_classes
         FROM student_subjects ss
         JOIN students s ON s.id = ss.student_id
         JOIN users u ON u.id = s.user_id
         JOIN subjects sub ON sub.id = ss.subject_id
         LEFT JOIN attendance_records ar ON ar.student_id = s.id AND ar.subject_id = sub.id
         GROUP BY s.id, sub.id`
      )
      .all() as Array<{
      student_id: number;
      student_code: string;
      full_name: string;
      subject_id: number;
      subject_code: string;
      subject_name: string;
      lecture_duration_minutes: number;
      total_classes: number;
      present_classes: number;
    }>;

    const deficitAlerts = enrollmentRows
      .map((r) => {
        const metrics = calculateAttendanceMetrics(
          r.present_classes,
          r.total_classes,
          r.lecture_duration_minutes
        );
        return { ...r, ...metrics };
      })
      .filter((r) => r.total_classes > 0 && r.belowThreshold)
      .sort((a, b) => a.percentage - b.percentage);

    const recentSessions = db
      .prepare(
        `SELECT ses.id, ses.session_date, ses.topic, ses.status, ses.created_at,
                sub.code AS subject_code, sub.name AS subject_name,
                u.full_name AS teacher_name,
                COUNT(ar.id) AS marked_count,
                COALESCE(SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END), 0) AS present_count
         FROM attendance_sessions ses
         JOIN subjects sub ON sub.id = ses.subject_id
         JOIN teachers t ON t.id = ses.teacher_id
         JOIN users u ON u.id = t.user_id
         LEFT JOIN attendance_records ar ON ar.session_id = ses.id
         GROUP BY ses.id
         ORDER BY ses.created_at DESC
         LIMIT 8`
      )
      .all();

    const notices = db
      .prepare(
        `SELECT n.*, u.full_name AS author_name
         FROM notices n
         JOIN users u ON u.id = n.author_id
         ORDER BY n.published_at DESC
         LIMIT 5`
      )
      .all();

    res.json({
      stats: {
        totalStudents,
        totalTeachers,
        totalSubjects,
        totalSessions,
        overallPercentage,
        deficitAlertCount: deficitAlerts.length,
      },
      deficitAlerts: deficitAlerts.slice(0, 10),
      recentSessions,
      notices,
    });
  });

  // Departments, Courses, Semesters
  app.get('/api/admin/academics', requireAuth, requireRole('admin'), (_req, res) => {
    const departments = db.prepare('SELECT * FROM departments ORDER BY code').all();
    const courses = db
      .prepare(
        `SELECT c.*, d.code AS department_code, d.name AS department_name
         FROM courses c JOIN departments d ON d.id = c.department_id ORDER BY c.code`
      )
      .all();
    const semesters = db
      .prepare(
        `SELECT sem.*, c.code AS course_code, c.name AS course_name
         FROM semesters sem JOIN courses c ON c.id = sem.course_id
         ORDER BY c.code, sem.number, sem.division`
      )
      .all();
    res.json({ departments, courses, semesters });
  });

  app.post('/api/admin/departments', requireAuth, requireRole('admin'), (req, res) => {
    const { code, name } = req.body as { code?: string; name?: string };
    if (!code || !name) {
      res.status(400).json({ error: 'Department code and name are required.' });
      return;
    }
    try {
      const result = db
        .prepare('INSERT INTO departments (code, name) VALUES (?, ?)')
        .run(code.trim().toUpperCase(), name.trim());
      res.status(201).json({ id: Number(result.lastInsertRowid) });
    } catch {
      res.status(409).json({ error: 'Department code already exists.' });
    }
  });

  app.delete('/api/admin/departments/:id', requireAuth, requireRole('admin'), (req, res) => {
    try {
      db.prepare('DELETE FROM departments WHERE id = ?').run(Number(req.params.id));
      res.json({ ok: true });
    } catch {
      res.status(400).json({ error: 'Cannot delete department while teachers, students, or subjects reference it.' });
    }
  });

  app.post('/api/admin/courses', requireAuth, requireRole('admin'), (req, res) => {
    const { department_id, code, name, duration_years } = req.body as {
      department_id?: number;
      code?: string;
      name?: string;
      duration_years?: number;
    };
    if (!department_id || !code || !name) {
      res.status(400).json({ error: 'Department, course code, and course name are required.' });
      return;
    }
    try {
      const result = db
        .prepare('INSERT INTO courses (department_id, code, name, duration_years) VALUES (?, ?, ?, ?)')
        .run(Number(department_id), code.trim().toUpperCase(), name.trim(), Number(duration_years) || 4);
      res.status(201).json({ id: Number(result.lastInsertRowid) });
    } catch {
      res.status(409).json({ error: 'Course code already exists.' });
    }
  });

  app.delete('/api/admin/courses/:id', requireAuth, requireRole('admin'), (req, res) => {
    try {
      db.prepare('DELETE FROM courses WHERE id = ?').run(Number(req.params.id));
      res.json({ ok: true });
    } catch {
      res.status(400).json({ error: 'Cannot delete course while students reference it.' });
    }
  });

  app.post('/api/admin/semesters', requireAuth, requireRole('admin'), (req, res) => {
    const { course_id, number, label, division } = req.body as {
      course_id?: number;
      number?: number;
      label?: string;
      division?: string;
    };
    if (!course_id || !number) {
      res.status(400).json({ error: 'Course and semester number are required.' });
      return;
    }
    const semLabel = (label || `Semester ${number}`).trim();
    const semDiv = (division || 'A').trim().toUpperCase();
    try {
      const result = db
        .prepare('INSERT INTO semesters (course_id, number, label, division) VALUES (?, ?, ?, ?)')
        .run(Number(course_id), Number(number), semLabel, semDiv);
      res.status(201).json({ id: Number(result.lastInsertRowid) });
    } catch {
      res.status(409).json({ error: 'This semester and division already exist for the selected course.' });
    }
  });

  app.delete('/api/admin/semesters/:id', requireAuth, requireRole('admin'), (req, res) => {
    try {
      db.prepare('DELETE FROM semesters WHERE id = ?').run(Number(req.params.id));
      res.json({ ok: true });
    } catch {
      res.status(400).json({ error: 'Cannot delete semester while students or subjects reference it.' });
    }
  });

  // Students CRUD
  app.get('/api/admin/students', requireAuth, requireRole('admin'), (_req, res) => {
    const students = db
      .prepare(
        `SELECT s.id, s.user_id, s.student_code, s.roll_number, s.department_id, s.course_id, s.semester_id, s.batch_year,
                u.login_id, u.email, u.full_name, u.phone, u.is_active,
                d.code AS department_code, d.name AS department_name,
                c.code AS course_code, c.name AS course_name,
                sem.label AS semester_label, sem.division
         FROM students s
         JOIN users u ON u.id = s.user_id
         JOIN departments d ON d.id = s.department_id
         JOIN courses c ON c.id = s.course_id
         JOIN semesters sem ON sem.id = s.semester_id
         ORDER BY s.student_code ASC`
      )
      .all();
    res.json({ students });
  });

  app.post('/api/admin/students', requireAuth, requireRole('admin'), (req, res) => {
    const {
      student_code,
      full_name,
      email,
      phone,
      password,
      roll_number,
      department_id,
      course_id,
      semester_id,
      batch_year,
    } = req.body as Record<string, string | number | undefined>;

    if (!full_name || !email || !department_id || !course_id || !semester_id) {
      res.status(400).json({ error: 'Full name, email, department, course, and semester are required.' });
      return;
    }

    const nextNumberRow = db.prepare('SELECT COUNT(*) as c FROM students').get() as { c: number };
    const year = Number(batch_year) || 2026;
    const generatedCode =
      (student_code && String(student_code).trim().toUpperCase()) ||
      `STU-${year}-${String(nextNumberRow.c + 1).padStart(3, '0')}`;
    const cleanRoll = (roll_number && String(roll_number).trim()) || generatedCode;
    const passHash = hashPassword((password && String(password)) || 'password123');

    try {
      const userRes = db
        .prepare(
          `INSERT INTO users (login_id, email, password_hash, role, full_name, phone)
           VALUES (?, ?, ?, 'student', ?, ?)`
        )
        .run(generatedCode, String(email).trim().toLowerCase(), passHash, String(full_name).trim(), String(phone || '').trim());

      const userId = Number(userRes.lastInsertRowid);
      const stuRes = db
        .prepare(
          `INSERT INTO students (user_id, student_code, roll_number, department_id, course_id, semester_id, batch_year)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          userId,
          generatedCode,
          cleanRoll,
          Number(department_id),
          Number(course_id),
          Number(semester_id),
          year
        );

      res.status(201).json({ id: Number(stuRes.lastInsertRowid), student_code: generatedCode });
    } catch {
      res.status(409).json({ error: 'Student ID or email already exists.' });
    }
  });

  app.put('/api/admin/students/:id', requireAuth, requireRole('admin'), (req, res) => {
    const studentId = Number(req.params.id);
    const existing = db.prepare('SELECT user_id FROM students WHERE id = ?').get(studentId) as
      | { user_id: number }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    const { full_name, email, phone, roll_number, department_id, course_id, semester_id, batch_year, is_active } =
      req.body as Record<string, string | number | boolean | undefined>;

    try {
      db.prepare(
        `UPDATE users SET full_name = ?, email = ?, phone = ?, is_active = ? WHERE id = ?`
      ).run(
        String(full_name).trim(),
        String(email).trim().toLowerCase(),
        String(phone || '').trim(),
        is_active === false || is_active === 0 ? 0 : 1,
        existing.user_id
      );

      db.prepare(
        `UPDATE students SET roll_number = ?, department_id = ?, course_id = ?, semester_id = ?, batch_year = ? WHERE id = ?`
      ).run(
        String(roll_number).trim(),
        Number(department_id),
        Number(course_id),
        Number(semester_id),
        Number(batch_year) || 2026,
        studentId
      );

      res.json({ ok: true });
    } catch {
      res.status(409).json({ error: 'Email conflicts with another account.' });
    }
  });

  app.delete('/api/admin/students/:id', requireAuth, requireRole('admin'), (req, res) => {
    const studentId = Number(req.params.id);
    const existing = db.prepare('SELECT user_id FROM students WHERE id = ?').get(studentId) as
      | { user_id: number }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(existing.user_id);
    res.json({ ok: true });
  });

  // Teachers CRUD
  app.get('/api/admin/teachers', requireAuth, requireRole('admin'), (_req, res) => {
    const teachers = db
      .prepare(
        `SELECT t.id, t.user_id, t.teacher_code, t.department_id, t.designation, t.specialization,
                u.login_id, u.email, u.full_name, u.phone, u.is_active,
                d.code AS department_code, d.name AS department_name
         FROM teachers t
         JOIN users u ON u.id = t.user_id
         JOIN departments d ON d.id = t.department_id
         ORDER BY t.teacher_code ASC`
      )
      .all();
    res.json({ teachers });
  });

  app.post('/api/admin/teachers', requireAuth, requireRole('admin'), (req, res) => {
    const { teacher_code, full_name, email, phone, password, department_id, designation, specialization } =
      req.body as Record<string, string | number | undefined>;

    if (!full_name || !email || !department_id) {
      res.status(400).json({ error: 'Full name, email, and department are required.' });
      return;
    }

    const nextRow = db.prepare('SELECT COUNT(*) as c FROM teachers').get() as { c: number };
    const generatedCode =
      (teacher_code && String(teacher_code).trim().toUpperCase()) ||
      `TCH-${String(101 + nextRow.c)}`;
    const passHash = hashPassword((password && String(password)) || 'password123');

    try {
      const userRes = db
        .prepare(
          `INSERT INTO users (login_id, email, password_hash, role, full_name, phone)
           VALUES (?, ?, ?, 'teacher', ?, ?)`
        )
        .run(
          generatedCode,
          String(email).trim().toLowerCase(),
          passHash,
          String(full_name).trim(),
          String(phone || '').trim()
        );

      const userId = Number(userRes.lastInsertRowid);
      const tRes = db
        .prepare(
          `INSERT INTO teachers (user_id, teacher_code, department_id, designation, specialization)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          userId,
          generatedCode,
          Number(department_id),
          String(designation || 'Assistant Professor').trim(),
          String(specialization || '').trim()
        );

      res.status(201).json({ id: Number(tRes.lastInsertRowid), teacher_code: generatedCode });
    } catch {
      res.status(409).json({ error: 'Teacher ID or email already exists.' });
    }
  });

  app.put('/api/admin/teachers/:id', requireAuth, requireRole('admin'), (req, res) => {
    const teacherId = Number(req.params.id);
    const existing = db.prepare('SELECT user_id FROM teachers WHERE id = ?').get(teacherId) as
      | { user_id: number }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Teacher not found.' });
      return;
    }

    const { full_name, email, phone, department_id, designation, specialization, is_active } =
      req.body as Record<string, string | number | boolean | undefined>;

    try {
      db.prepare('UPDATE users SET full_name = ?, email = ?, phone = ?, is_active = ? WHERE id = ?').run(
        String(full_name).trim(),
        String(email).trim().toLowerCase(),
        String(phone || '').trim(),
        is_active === false || is_active === 0 ? 0 : 1,
        existing.user_id
      );

      db.prepare(
        'UPDATE teachers SET department_id = ?, designation = ?, specialization = ? WHERE id = ?'
      ).run(
        Number(department_id),
        String(designation || 'Assistant Professor').trim(),
        String(specialization || '').trim(),
        teacherId
      );

      res.json({ ok: true });
    } catch {
      res.status(409).json({ error: 'Email conflicts with another account.' });
    }
  });

  app.delete('/api/admin/teachers/:id', requireAuth, requireRole('admin'), (req, res) => {
    const teacherId = Number(req.params.id);
    const existing = db.prepare('SELECT user_id FROM teachers WHERE id = ?').get(teacherId) as
      | { user_id: number }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Teacher not found.' });
      return;
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(existing.user_id);
    res.json({ ok: true });
  });

  app.post('/api/admin/users/:userId/reset-password', requireAuth, requireRole('admin'), (req, res) => {
    const userId = Number(req.params.userId);
    const { new_password } = req.body as { new_password?: string };
    const nextPass = (new_password && new_password.trim()) || 'password123';
    if (nextPass.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(nextPass), userId);
    res.json({ message: 'Password reset successfully.' });
  });

  // Subjects, Teacher Assignments, Student Enrollments
  app.get('/api/admin/subjects', requireAuth, requireRole('admin'), (_req, res) => {
    const subjects = db
      .prepare(
        `SELECT sub.*, d.code AS department_code, d.name AS department_name,
                sem.label AS semester_label, sem.division,
                (SELECT COUNT(*) FROM student_subjects ss WHERE ss.subject_id = sub.id) AS enrolled_count
         FROM subjects sub
         JOIN departments d ON d.id = sub.department_id
         JOIN semesters sem ON sem.id = sub.semester_id
         ORDER BY sub.code ASC`
      )
      .all();

    const teacherAssignments = db
      .prepare(
        `SELECT ts.id, ts.teacher_id, ts.subject_id, ts.academic_term,
                t.teacher_code, u.full_name AS teacher_name,
                sub.code AS subject_code, sub.name AS subject_name
         FROM teacher_subjects ts
         JOIN teachers t ON t.id = ts.teacher_id
         JOIN users u ON u.id = t.user_id
         JOIN subjects sub ON sub.id = ts.subject_id
         ORDER BY sub.code`
      )
      .all();

    const studentEnrollments = db
      .prepare(
        `SELECT ss.id, ss.student_id, ss.subject_id, ss.enrolled_at,
                s.student_code, u.full_name AS student_name,
                sub.code AS subject_code, sub.name AS subject_name
         FROM student_subjects ss
         JOIN students s ON s.id = ss.student_id
         JOIN users u ON u.id = s.user_id
         JOIN subjects sub ON sub.id = ss.subject_id
         ORDER BY sub.code, s.student_code`
      )
      .all();

    res.json({ subjects, teacherAssignments, studentEnrollments });
  });

  app.post('/api/admin/subjects', requireAuth, requireRole('admin'), (req, res) => {
    const { code, name, department_id, semester_id, credits, lecture_duration_minutes } = req.body as Record<
      string,
      string | number | undefined
    >;
    if (!code || !name || !department_id || !semester_id) {
      res.status(400).json({ error: 'Subject code, name, department, and semester are required.' });
      return;
    }
    try {
      const r = db
        .prepare(
          `INSERT INTO subjects (code, name, department_id, semester_id, credits, lecture_duration_minutes)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          String(code).trim().toUpperCase(),
          String(name).trim(),
          Number(department_id),
          Number(semester_id),
          Number(credits) || 4,
          Number(lecture_duration_minutes) || 60
        );
      res.status(201).json({ id: Number(r.lastInsertRowid) });
    } catch {
      res.status(409).json({ error: 'Subject code already exists.' });
    }
  });

  app.delete('/api/admin/subjects/:id', requireAuth, requireRole('admin'), (req, res) => {
    db.prepare('DELETE FROM subjects WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  app.post('/api/admin/teacher-subjects', requireAuth, requireRole('admin'), (req, res) => {
    const { teacher_id, subject_id, academic_term } = req.body as {
      teacher_id?: number;
      subject_id?: number;
      academic_term?: string;
    };
    if (!teacher_id || !subject_id) {
      res.status(400).json({ error: 'Teacher and subject are required.' });
      return;
    }
    try {
      const r = db
        .prepare('INSERT INTO teacher_subjects (teacher_id, subject_id, academic_term) VALUES (?, ?, ?)')
        .run(Number(teacher_id), Number(subject_id), (academic_term || '2026-Odd').trim());
      res.status(201).json({ id: Number(r.lastInsertRowid) });
    } catch {
      res.status(409).json({ error: 'This teacher is already assigned to the selected subject.' });
    }
  });

  app.delete('/api/admin/teacher-subjects/:id', requireAuth, requireRole('admin'), (req, res) => {
    db.prepare('DELETE FROM teacher_subjects WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  app.post('/api/admin/student-subjects', requireAuth, requireRole('admin'), (req, res) => {
    const { student_id, student_ids, subject_id } = req.body as {
      student_id?: number;
      student_ids?: number[];
      subject_id?: number;
    };
    const ids = Array.isArray(student_ids)
      ? student_ids.map(Number)
      : student_id
      ? [Number(student_id)]
      : [];

    if (!subject_id || ids.length === 0) {
      res.status(400).json({ error: 'Subject and at least one student are required.' });
      return;
    }

    const stmt = db.prepare('INSERT OR IGNORE INTO student_subjects (student_id, subject_id) VALUES (?, ?)');
    let inserted = 0;
    for (const sid of ids) {
      const info = stmt.run(sid, Number(subject_id));
      if (info.changes > 0) inserted++;
    }
    res.status(201).json({ inserted });
  });

  app.delete('/api/admin/student-subjects/:id', requireAuth, requireRole('admin'), (req, res) => {
    db.prepare('DELETE FROM student_subjects WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  // Admin Attendance Records & Reports
  app.get('/api/admin/attendance/report', requireAuth, requireRole('admin'), (req, res) => {
    const subjectIdFilter = req.query.subjectId ? Number(req.query.subjectId) : null;
    const format = req.query.format === 'csv' ? 'csv' : 'json';

    const sql = `
      SELECT s.student_code, s.roll_number, u.full_name AS student_name,
             sub.id AS subject_id, sub.code AS subject_code, sub.name AS subject_name, sub.lecture_duration_minutes,
             COUNT(ar.id) AS total_classes,
             COALESCE(SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END), 0) AS present_classes
      FROM student_subjects ss
      JOIN students s ON s.id = ss.student_id
      JOIN users u ON u.id = s.user_id
      JOIN subjects sub ON sub.id = ss.subject_id
      LEFT JOIN attendance_records ar ON ar.student_id = s.id AND ar.subject_id = sub.id
      ${subjectIdFilter ? 'WHERE sub.id = ?' : ''}
      GROUP BY s.id, sub.id
      ORDER BY sub.code, s.student_code
    `;

    const rows = (subjectIdFilter ? db.prepare(sql).all(subjectIdFilter) : db.prepare(sql).all()) as Array<{
      student_code: string;
      roll_number: string;
      student_name: string;
      subject_id: number;
      subject_code: string;
      subject_name: string;
      lecture_duration_minutes: number;
      total_classes: number;
      present_classes: number;
    }>;

    const report = rows.map((r) => ({
      ...r,
      ...calculateAttendanceMetrics(r.present_classes, r.total_classes, r.lecture_duration_minutes),
    }));

    if (format === 'csv') {
      const header = [
        'Student ID',
        'Roll Number',
        'Student Name',
        'Subject Code',
        'Subject Name',
        'Present',
        'Absent',
        'Total Conducted',
        'Attendance %',
        'Status',
        'Classes Needed For 75%',
      ].join(',');
      const lines = report.map((r) =>
        [
          csvEscape(r.student_code),
          csvEscape(r.roll_number),
          csvEscape(r.student_name),
          csvEscape(r.subject_code),
          csvEscape(r.subject_name),
          r.present,
          r.absent,
          r.total,
          `${r.percentage}%`,
          r.belowThreshold ? 'Below 75%' : 'Nominal',
          r.requiredClasses,
        ].join(',')
      );
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="smart_erp_attendance_report.csv"');
      res.send([header, ...lines].join('\n'));
      return;
    }

    const sessions = db
      .prepare(
        `SELECT ses.id, ses.session_date, ses.topic, ses.status, ses.created_at, ses.closed_at,
                sub.code AS subject_code, sub.name AS subject_name, u.full_name AS teacher_name,
                COUNT(ar.id) AS total_records,
                COALESCE(SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END), 0) AS present_records
         FROM attendance_sessions ses
         JOIN subjects sub ON sub.id = ses.subject_id
         JOIN teachers t ON t.id = ses.teacher_id
         JOIN users u ON u.id = t.user_id
         LEFT JOIN attendance_records ar ON ar.session_id = ses.id
         GROUP BY ses.id
         ORDER BY ses.created_at DESC
         LIMIT 50`
      )
      .all();

    res.json({ report, sessions });
  });

  // Admin Notices & Timetable
  app.get('/api/admin/notices', requireAuth, requireRole('admin'), (_req, res) => {
    const notices = db
      .prepare(
        `SELECT n.*, u.full_name AS author_name FROM notices n JOIN users u ON u.id = n.author_id ORDER BY n.published_at DESC`
      )
      .all();
    const timetable = db
      .prepare(
        `SELECT tt.*, sub.code AS subject_code, sub.name AS subject_name,
                u.full_name AS teacher_name, sem.label AS semester_label, sem.division
         FROM timetable tt
         JOIN subjects sub ON sub.id = tt.subject_id
         JOIN teachers t ON t.id = tt.teacher_id
         JOIN users u ON u.id = t.user_id
         JOIN semesters sem ON sem.id = tt.semester_id
         ORDER BY CASE tt.day_of_week
           WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
           WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 ELSE 6 END, tt.start_time`
      )
      .all();
    res.json({ notices, timetable });
  });

  app.post('/api/admin/notices', requireAuth, requireRole('admin'), (req: AuthRequest, res) => {
    const { title, content, category, target_role } = req.body as {
      title?: string;
      content?: string;
      category?: string;
      target_role?: string;
    };
    if (!title || !content) {
      res.status(400).json({ error: 'Notice title and content are required.' });
      return;
    }
    const r = db
      .prepare(
        `INSERT INTO notices (title, content, category, target_role, author_id) VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        title.trim(),
        content.trim(),
        category || 'Academic',
        target_role || 'all',
        req.user!.id
      );
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  });

  app.delete('/api/admin/notices/:id', requireAuth, requireRole('admin'), (req, res) => {
    db.prepare('DELETE FROM notices WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  app.post('/api/admin/timetable', requireAuth, requireRole('admin'), (req, res) => {
    const { subject_id, teacher_id, semester_id, day_of_week, start_time, end_time, room } = req.body as Record<
      string,
      string | number | undefined
    >;
    if (!subject_id || !teacher_id || !semester_id || !day_of_week || !start_time || !end_time || !room) {
      res.status(400).json({ error: 'All timetable fields are required.' });
      return;
    }
    const r = db
      .prepare(
        `INSERT INTO timetable (subject_id, teacher_id, semester_id, day_of_week, start_time, end_time, room)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        Number(subject_id),
        Number(teacher_id),
        Number(semester_id),
        String(day_of_week),
        String(start_time),
        String(end_time),
        String(room).trim()
      );
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  });

  app.delete('/api/admin/timetable/:id', requireAuth, requireRole('admin'), (req, res) => {
    db.prepare('DELETE FROM timetable WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  // ==========================================
  // TEACHER ROUTES
  // ==========================================
  app.get('/api/teacher/dashboard', requireAuth, requireRole('teacher'), (req: AuthRequest, res) => {
    const teacherId = req.user!.teacher_id!;
    const subjects = db
      .prepare(
        `SELECT sub.*, sem.label AS semester_label, sem.division, d.code AS department_code,
                (SELECT COUNT(*) FROM student_subjects ss WHERE ss.subject_id = sub.id) AS enrolled_count,
                (SELECT COUNT(*) FROM attendance_sessions ses WHERE ses.subject_id = sub.id) AS sessions_count
         FROM teacher_subjects ts
         JOIN subjects sub ON sub.id = ts.subject_id
         JOIN semesters sem ON sem.id = sub.semester_id
         JOIN departments d ON d.id = sub.department_id
         WHERE ts.teacher_id = ?
         ORDER BY sub.code`
      )
      .all(teacherId);

    const activeSession = db
      .prepare(
        `SELECT ses.*, sub.code AS subject_code, sub.name AS subject_name
         FROM attendance_sessions ses
         JOIN subjects sub ON sub.id = ses.subject_id
         WHERE ses.teacher_id = ? AND ses.status = 'active'
         ORDER BY ses.created_at DESC LIMIT 1`
      )
      .get(teacherId);

    const recentSessions = db
      .prepare(
        `SELECT ses.*, sub.code AS subject_code, sub.name AS subject_name,
                COUNT(ar.id) AS total_records,
                COALESCE(SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END), 0) AS present_count
         FROM attendance_sessions ses
         JOIN subjects sub ON sub.id = ses.subject_id
         LEFT JOIN attendance_records ar ON ar.session_id = ses.id
         WHERE ses.teacher_id = ?
         GROUP BY ses.id
         ORDER BY ses.created_at DESC
         LIMIT 6`
      )
      .all(teacherId);

    const pendingLeaves = (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM leave_requests lr
           WHERE lr.status = 'pending'
             AND (lr.subject_id IS NULL OR lr.subject_id IN (SELECT subject_id FROM teacher_subjects WHERE teacher_id = ?))`
        )
        .get(teacherId) as { c: number }
    ).c;

    res.json({ subjects, activeSession: activeSession || null, recentSessions, pendingLeaves });
  });

  app.get('/api/teacher/subjects', requireAuth, requireRole('teacher'), (req: AuthRequest, res) => {
    const teacherId = req.user!.teacher_id!;
    const subjects = db
      .prepare(
        `SELECT sub.*, sem.label AS semester_label, sem.division, d.code AS department_code
         FROM teacher_subjects ts
         JOIN subjects sub ON sub.id = ts.subject_id
         JOIN semesters sem ON sem.id = sub.semester_id
         JOIN departments d ON d.id = sub.department_id
         WHERE ts.teacher_id = ?
         ORDER BY sub.code`
      )
      .all(teacherId) as Array<{
      id: number;
      code: string;
      name: string;
      credits: number;
      lecture_duration_minutes: number;
      semester_label: string;
      division: string;
      department_code: string;
    }>;

    const enriched = subjects.map((sub) => {
      const students = db
        .prepare(
          `SELECT s.id, s.student_code, s.roll_number, u.full_name, u.email,
                  COUNT(ar.id) AS total_classes,
                  COALESCE(SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END), 0) AS present_classes
           FROM student_subjects ss
           JOIN students s ON s.id = ss.student_id
           JOIN users u ON u.id = s.user_id
           LEFT JOIN attendance_records ar ON ar.student_id = s.id AND ar.subject_id = ss.subject_id
           WHERE ss.subject_id = ?
           GROUP BY s.id
           ORDER BY s.student_code`
        )
        .all(sub.id) as Array<{
        id: number;
        student_code: string;
        roll_number: string;
        full_name: string;
        email: string;
        total_classes: number;
        present_classes: number;
      }>;

      return {
        ...sub,
        students: students.map((st) => ({
          ...st,
          ...calculateAttendanceMetrics(st.present_classes, st.total_classes, sub.lecture_duration_minutes),
        })),
      };
    });

    res.json({ subjects: enriched });
  });

  app.post('/api/teacher/sessions', requireAuth, requireRole('teacher'), (req: AuthRequest, res) => {
    const teacherId = req.user!.teacher_id!;
    const { subject_id, duration_seconds, topic, room_code } = req.body as {
      subject_id?: number;
      duration_seconds?: number;
      topic?: string;
      room_code?: string;
    };

    if (!subject_id) {
      res.status(400).json({ error: 'Please select an assigned subject.' });
      return;
    }

    const assigned = db
      .prepare('SELECT id FROM teacher_subjects WHERE teacher_id = ? AND subject_id = ?')
      .get(teacherId, Number(subject_id));
    if (!assigned) {
      res.status(403).json({ error: 'You are not assigned to teach this subject.' });
      return;
    }

    const dur = Math.min(900, Math.max(20, Number(duration_seconds) || 60));
    const token = crypto.randomBytes(24).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + dur * 1000).toISOString();
    const sessionDate = now.toISOString().slice(0, 10);

    const r = db
      .prepare(
        `INSERT INTO attendance_sessions (subject_id, teacher_id, token, room_code, topic, session_date, duration_seconds, expires_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`
      )
      .run(
        Number(subject_id),
        teacherId,
        token,
        (room_code || '').trim(),
        (topic || 'Regular Lecture').trim(),
        sessionDate,
        dur,
        expiresAt
      );

    const sessionId = Number(r.lastInsertRowid);
    const origin = getBaseOrigin(req);
    res.status(201).json({
      sessionId,
      qrUrl: `${origin}/scan/${token}`,
      token,
      expiresAt,
    });
  });

  app.get('/api/teacher/sessions', requireAuth, requireRole('teacher'), (req: AuthRequest, res) => {
    const teacherId = req.user!.teacher_id!;
    const sessions = db
      .prepare(
        `SELECT ses.*, sub.code AS subject_code, sub.name AS subject_name,
                (SELECT COUNT(*) FROM student_subjects ss WHERE ss.subject_id = ses.subject_id) AS enrolled_count,
                COUNT(ar.id) AS marked_count,
                COALESCE(SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END), 0) AS present_count
         FROM attendance_sessions ses
         JOIN subjects sub ON sub.id = ses.subject_id
         LEFT JOIN attendance_records ar ON ar.session_id = ses.id
         WHERE ses.teacher_id = ?
         GROUP BY ses.id
         ORDER BY ses.created_at DESC`
      )
      .all(teacherId);
    res.json({ sessions });
  });

  app.get('/api/teacher/sessions/:id', requireAuth, requireRole('teacher'), (req: AuthRequest, res) => {
    const teacherId = req.user!.teacher_id!;
    const sessionId = Number(req.params.id);
    const session = db
      .prepare(
        `SELECT ses.*, sub.code AS subject_code, sub.name AS subject_name, sub.lecture_duration_minutes
         FROM attendance_sessions ses
         JOIN subjects sub ON sub.id = ses.subject_id
         WHERE ses.id = ? AND ses.teacher_id = ?`
      )
      .get(sessionId, teacherId) as
      | {
          id: number;
          subject_id: number;
          token: string;
          room_code: string;
          topic: string;
          session_date: string;
          duration_seconds: number;
          expires_at: string;
          status: string;
          created_at: string;
          closed_at: string | null;
          subject_code: string;
          subject_name: string;
          lecture_duration_minutes: number;
        }
      | undefined;

    if (!session) {
      res.status(404).json({ error: 'Attendance session not found.' });
      return;
    }

    const roster = db
      .prepare(
        `SELECT s.id AS student_id, s.student_code, s.roll_number, u.full_name, u.email,
                ar.id AS record_id, ar.status AS record_status, ar.marked_method, ar.marked_at
         FROM student_subjects ss
         JOIN students s ON s.id = ss.student_id
         JOIN users u ON u.id = s.user_id
         LEFT JOIN attendance_records ar ON ar.session_id = ? AND ar.student_id = s.id
         WHERE ss.subject_id = ?
         ORDER BY s.student_code`
      )
      .all(sessionId, session.subject_id);

    const auditLogs = db
      .prepare(
        `SELECT al.*, s.student_code, stu_u.full_name AS student_name, ch_u.full_name AS changed_by_name
         FROM attendance_audit_logs al
         JOIN students s ON s.id = al.student_id
         JOIN users stu_u ON stu_u.id = s.user_id
         JOIN users ch_u ON ch_u.id = al.changed_by_user_id
         WHERE al.session_id = ?
         ORDER BY al.changed_at DESC`
      )
      .all(sessionId);

    const origin = getBaseOrigin(req);
    res.json({
      session,
      qrUrl: `${origin}/scan/${session.token}`,
      roster,
      auditLogs,
    });
  });

  app.post('/api/teacher/sessions/:id/regenerate', requireAuth, requireRole('teacher'), (req: AuthRequest, res) => {
    const teacherId = req.user!.teacher_id!;
    const sessionId = Number(req.params.id);
    const { duration_seconds } = req.body as { duration_seconds?: number };

    const session = db
      .prepare('SELECT id, duration_seconds, status FROM attendance_sessions WHERE id = ? AND teacher_id = ?')
      .get(sessionId, teacherId) as { id: number; duration_seconds: number; status: string } | undefined;

    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }
    if (session.status !== 'active') {
      res.status(400).json({ error: 'Cannot regenerate QR for a closed session.' });
      return;
    }

    const dur = Math.min(900, Math.max(20, Number(duration_seconds) || session.duration_seconds));
    const newToken = crypto.randomBytes(24).toString('hex');
    const newExpires = new Date(Date.now() + dur * 1000).toISOString();

    db.prepare('UPDATE attendance_sessions SET token = ?, duration_seconds = ?, expires_at = ? WHERE id = ?').run(
      newToken,
      dur,
      newExpires,
      sessionId
    );

    const origin = getBaseOrigin(req);
    res.json({ token: newToken, expiresAt: newExpires, qrUrl: `${origin}/scan/${newToken}` });
  });

  app.post('/api/teacher/sessions/:id/close', requireAuth, requireRole('teacher'), (req: AuthRequest, res) => {
    const teacherId = req.user!.teacher_id!;
    const sessionId = Number(req.params.id);

    const session = db
      .prepare('SELECT id, subject_id, status FROM attendance_sessions WHERE id = ? AND teacher_id = ?')
      .get(sessionId, teacherId) as { id: number; subject_id: number; status: string } | undefined;

    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    if (session.status === 'active') {
      // Mark all enrolled students who did not scan as 'absent'
      const unmarked = db
        .prepare(
          `SELECT ss.student_id
           FROM student_subjects ss
           WHERE ss.subject_id = ?
             AND ss.student_id NOT IN (SELECT student_id FROM attendance_records WHERE session_id = ?)`
        )
        .all(session.subject_id, sessionId) as Array<{ student_id: number }>;

      const insertAbsent = db.prepare(
        `INSERT INTO attendance_records (session_id, student_id, subject_id, status, marked_method, marked_at)
         VALUES (?, ?, ?, 'absent', 'manual', datetime('now'))`
      );
      for (const row of unmarked) {
        insertAbsent.run(sessionId, row.student_id, session.subject_id);
      }

      db.prepare("UPDATE attendance_sessions SET status = 'closed', closed_at = datetime('now') WHERE id = ?").run(
        sessionId
      );
    }

    res.json({ ok: true });
  });

  app.post('/api/teacher/sessions/:id/mark', requireAuth, requireRole('teacher'), (req: AuthRequest, res) => {
    const teacherId = req.user!.teacher_id!;
    const sessionId = Number(req.params.id);
    const { student_id, status, reason } = req.body as {
      student_id?: number;
      status?: 'present' | 'absent';
      reason?: string;
    };

    if (!student_id || (status !== 'present' && status !== 'absent')) {
      res.status(400).json({ error: 'Student ID and valid status (present/absent) are required.' });
      return;
    }

    const session = db
      .prepare('SELECT id, subject_id FROM attendance_sessions WHERE id = ? AND teacher_id = ?')
      .get(sessionId, teacherId) as { id: number; subject_id: number } | undefined;

    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    const existing = db
      .prepare('SELECT id, status FROM attendance_records WHERE session_id = ? AND student_id = ?')
      .get(sessionId, Number(student_id)) as { id: number; status: string } | undefined;

    let recordId: number;
    const prevStatus = existing ? existing.status : 'unmarked';

    if (existing) {
      db.prepare(
        `UPDATE attendance_records SET status = ?, marked_method = 'manual', updated_by_user_id = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(status, req.user!.id, existing.id);
      recordId = existing.id;
    } else {
      const r = db
        .prepare(
          `INSERT INTO attendance_records (session_id, student_id, subject_id, status, marked_method, marked_at, updated_by_user_id, updated_at)
           VALUES (?, ?, ?, ?, 'manual', datetime('now'), ?, datetime('now'))`
        )
        .run(sessionId, Number(student_id), session.subject_id, status, req.user!.id);
      recordId = Number(r.lastInsertRowid);
    }

    db.prepare(
      `INSERT INTO attendance_audit_logs (record_id, session_id, student_id, previous_status, new_status, changed_by_user_id, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      recordId,
      sessionId,
      Number(student_id),
      prevStatus,
      status,
      req.user!.id,
      (reason || 'Teacher manual verification').trim()
    );

    res.json({ ok: true });
  });

  app.get('/api/teacher/reports/subject/:subjectId', requireAuth, requireRole('teacher'), (req: AuthRequest, res) => {
    const teacherId = req.user!.teacher_id!;
    const subjectId = Number(req.params.subjectId);
    const format = req.query.format === 'csv' ? 'csv' : 'json';

    const assigned = db
      .prepare(
        `SELECT sub.* FROM teacher_subjects ts JOIN subjects sub ON sub.id = ts.subject_id
         WHERE ts.teacher_id = ? AND ts.subject_id = ?`
      )
      .get(teacherId, subjectId) as
      | { id: number; code: string; name: string; lecture_duration_minutes: number }
      | undefined;

    if (!assigned) {
      res.status(403).json({ error: 'Not authorized for this subject.' });
      return;
    }

    const rows = db
      .prepare(
        `SELECT s.student_code, s.roll_number, u.full_name AS student_name, u.email,
                COUNT(ar.id) AS total_classes,
                COALESCE(SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END), 0) AS present_classes
         FROM student_subjects ss
         JOIN students s ON s.id = ss.student_id
         JOIN users u ON u.id = s.user_id
         LEFT JOIN attendance_records ar ON ar.student_id = s.id AND ar.subject_id = ss.subject_id
         WHERE ss.subject_id = ?
         GROUP BY s.id
         ORDER BY s.student_code`
      )
      .all(subjectId) as Array<{
      student_code: string;
      roll_number: string;
      student_name: string;
      email: string;
      total_classes: number;
      present_classes: number;
    }>;

    const report = rows.map((r) => ({
      ...r,
      ...calculateAttendanceMetrics(r.present_classes, r.total_classes, assigned.lecture_duration_minutes),
    }));

    if (format === 'csv') {
      const header = [
        'Student ID',
        'Roll Number',
        'Student Name',
        'Subject',
        'Present',
        'Absent',
        'Total Conducted',
        'Attendance %',
        'Status',
        'Classes Needed For 75%',
      ].join(',');
      const lines = report.map((r) =>
        [
          csvEscape(r.student_code),
          csvEscape(r.roll_number),
          csvEscape(r.student_name),
          csvEscape(`${assigned.code} - ${assigned.name}`),
          r.present,
          r.absent,
          r.total,
          `${r.percentage}%`,
          r.belowThreshold ? 'Below 75%' : 'Nominal',
          r.requiredClasses,
        ].join(',')
      );
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${assigned.code}_attendance.csv"`);
      res.send([header, ...lines].join('\n'));
      return;
    }

    res.json({ subject: assigned, report });
  });

  app.get('/api/teacher/leaves', requireAuth, requireRole('teacher'), (req: AuthRequest, res) => {
    const teacherId = req.user!.teacher_id!;
    const leaves = db
      .prepare(
        `SELECT lr.*, s.student_code, u.full_name AS student_name, sub.code AS subject_code, sub.name AS subject_name
         FROM leave_requests lr
         JOIN students s ON s.id = lr.student_id
         JOIN users u ON u.id = s.user_id
         LEFT JOIN subjects sub ON sub.id = lr.subject_id
         WHERE lr.subject_id IS NULL OR lr.subject_id IN (SELECT subject_id FROM teacher_subjects WHERE teacher_id = ?)
         ORDER BY CASE lr.status WHEN 'pending' THEN 0 ELSE 1 END, lr.created_at DESC`
      )
      .all(teacherId);
    res.json({ leaves });
  });

  app.put('/api/teacher/leaves/:id', requireAuth, requireRole('teacher'), (req: AuthRequest, res) => {
    const teacherId = req.user!.teacher_id!;
    const leaveId = Number(req.params.id);
    const { status, review_note } = req.body as { status?: 'approved' | 'rejected'; review_note?: string };

    if (status !== 'approved' && status !== 'rejected') {
      res.status(400).json({ error: 'Status must be approved or rejected.' });
      return;
    }

    db.prepare(
      `UPDATE leave_requests SET status = ?, reviewed_by_teacher_id = ?, review_note = ?, reviewed_at = datetime('now')
       WHERE id = ?`
    ).run(status, teacherId, (review_note || '').trim(), leaveId);
    res.json({ ok: true });
  });

  app.get('/api/teacher/schedule', requireAuth, requireRole('teacher'), (req: AuthRequest, res) => {
    const teacherId = req.user!.teacher_id!;
    const timetable = db
      .prepare(
        `SELECT tt.*, sub.code AS subject_code, sub.name AS subject_name, sem.label AS semester_label, sem.division
         FROM timetable tt
         JOIN subjects sub ON sub.id = tt.subject_id
         JOIN semesters sem ON sem.id = tt.semester_id
         WHERE tt.teacher_id = ?
         ORDER BY CASE tt.day_of_week
           WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
           WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 ELSE 6 END, tt.start_time`
      )
      .all(teacherId);

    const notices = db
      .prepare(
        `SELECT n.*, u.full_name AS author_name FROM notices n JOIN users u ON u.id = n.author_id
         WHERE n.target_role IN ('all', 'teacher') ORDER BY n.published_at DESC`
      )
      .all();

    res.json({ timetable, notices });
  });

  // ==========================================
  // STUDENT ROUTES
  // ==========================================
  app.get('/api/student/dashboard', requireAuth, requireRole('student'), (req: AuthRequest, res) => {
    const studentId = req.user!.student_id!;
    const studentRow = db
      .prepare(
        `SELECT s.*, d.name AS department_name, c.name AS course_name, sem.label AS semester_label, sem.division
         FROM students s
         JOIN departments d ON d.id = s.department_id
         JOIN courses c ON c.id = s.course_id
         JOIN semesters sem ON sem.id = s.semester_id
         WHERE s.id = ?`
      )
      .get(studentId) as Record<string, unknown>;

    const subjectRows = db
      .prepare(
        `SELECT sub.id, sub.code, sub.name, sub.credits, sub.lecture_duration_minutes,
                u.full_name AS teacher_name,
                COUNT(ar.id) AS total_classes,
                COALESCE(SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END), 0) AS present_classes
         FROM student_subjects ss
         JOIN subjects sub ON sub.id = ss.subject_id
         LEFT JOIN teacher_subjects ts ON ts.subject_id = sub.id
         LEFT JOIN teachers t ON t.id = ts.teacher_id
         LEFT JOIN users u ON u.id = t.user_id
         LEFT JOIN attendance_records ar ON ar.student_id = ss.student_id AND ar.subject_id = sub.id
         WHERE ss.student_id = ?
         GROUP BY sub.id
         ORDER BY sub.code`
      )
      .all(studentId) as Array<{
      id: number;
      code: string;
      name: string;
      credits: number;
      lecture_duration_minutes: number;
      teacher_name: string | null;
      total_classes: number;
      present_classes: number;
    }>;

    const subjects = subjectRows.map((sub) => ({
      ...sub,
      ...calculateAttendanceMetrics(sub.present_classes, sub.total_classes, sub.lecture_duration_minutes),
    }));

    const totalConducted = subjects.reduce((acc, s) => acc + s.total, 0);
    const totalPresent = subjects.reduce((acc, s) => acc + s.present, 0);
    const overall = calculateAttendanceMetrics(totalPresent, totalConducted, 60);

    const warnings = subjects.filter((s) => s.total > 0 && s.belowThreshold);

    const notices = db
      .prepare(
        `SELECT n.*, u.full_name AS author_name FROM notices n JOIN users u ON u.id = n.author_id
         WHERE n.target_role IN ('all', 'student') ORDER BY n.published_at DESC LIMIT 5`
      )
      .all();

    const timetable = db
      .prepare(
        `SELECT tt.*, sub.code AS subject_code, sub.name AS subject_name, u.full_name AS teacher_name
         FROM timetable tt
         JOIN subjects sub ON sub.id = tt.subject_id
         JOIN teachers t ON t.id = tt.teacher_id
         JOIN users u ON u.id = t.user_id
         WHERE tt.semester_id = ?
         ORDER BY CASE tt.day_of_week
           WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
           WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 ELSE 6 END, tt.start_time`
      )
      .all(studentRow.semester_id as number);

    res.json({
      student: studentRow,
      overall,
      subjects,
      warnings,
      notices,
      timetable,
    });
  });

  app.get('/api/student/attendance/history', requireAuth, requireRole('student'), (req: AuthRequest, res) => {
    const studentId = req.user!.student_id!;
    const records = db
      .prepare(
        `SELECT ar.id, ar.status, ar.marked_method, ar.marked_at,
                ses.session_date, ses.topic,
                sub.id AS subject_id, sub.code AS subject_code, sub.name AS subject_name
         FROM attendance_records ar
         JOIN attendance_sessions ses ON ses.id = ar.session_id
         JOIN subjects sub ON sub.id = ar.subject_id
         WHERE ar.student_id = ?
         ORDER BY ses.session_date DESC, ar.marked_at DESC`
      )
      .all(studentId);
    res.json({ records });
  });

  app.post('/api/student/attendance/scan', requireAuth, requireRole('student'), (req: AuthRequest, res) => {
    const studentId = req.user!.student_id!;
    const { rawToken, room_code } = req.body as { rawToken?: string; room_code?: string };

    if (!rawToken || !rawToken.trim()) {
      res.status(400).json({ error: 'QR session token is required.' });
      return;
    }

    // Extract token if user scanned or pasted full URL like https://.../scan/<token>
    let token = rawToken.trim();
    const scanMatch = token.match(/\/scan\/([a-fA-F0-9]+)/);
    if (scanMatch) {
      token = scanMatch[1];
    }

    const session = db
      .prepare(
        `SELECT ses.*, sub.code AS subject_code, sub.name AS subject_name, u.full_name AS teacher_name
         FROM attendance_sessions ses
         JOIN subjects sub ON sub.id = ses.subject_id
         JOIN teachers t ON t.id = ses.teacher_id
         JOIN users u ON u.id = t.user_id
         WHERE ses.token = ?`
      )
      .get(token) as
      | {
          id: number;
          subject_id: number;
          room_code: string;
          topic: string;
          session_date: string;
          expires_at: string;
          status: string;
          subject_code: string;
          subject_name: string;
          teacher_name: string;
        }
      | undefined;

    if (!session) {
      res.status(404).json({ error: 'Invalid or rotated QR code. Ask your teacher for the current QR code.' });
      return;
    }

    if (session.status !== 'active') {
      res.status(400).json({ error: 'This attendance session has already been closed by the teacher.' });
      return;
    }

    if (new Date(session.expires_at).getTime() <= Date.now()) {
      res.status(400).json({ error: 'This QR code has expired. Please scan the regenerated QR code.' });
      return;
    }

    if (session.room_code && session.room_code.trim().length > 0) {
      if ((room_code || '').trim() !== session.room_code.trim()) {
        res.status(403).json({
          error: 'Classroom verification PIN is required or incorrect.',
          requiresRoomCode: true,
        });
        return;
      }
    }

    const enrolled = db
      .prepare('SELECT id FROM student_subjects WHERE student_id = ? AND subject_id = ?')
      .get(studentId, session.subject_id);

    if (!enrolled) {
      res.status(403).json({
        error: `You are not enrolled in ${session.subject_code} (${session.subject_name}).`,
      });
      return;
    }

    const existing = db
      .prepare('SELECT id, status FROM attendance_records WHERE session_id = ? AND student_id = ?')
      .get(session.id, studentId) as { id: number; status: string } | undefined;

    if (existing) {
      res.status(409).json({
        error: `Attendance already marked (${existing.status}) for ${session.subject_code} on ${session.session_date}.`,
      });
      return;
    }

    const markedAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO attendance_records (session_id, student_id, subject_id, status, marked_method, marked_at)
       VALUES (?, ?, ?, 'present', 'qr_scan', ?)`
    ).run(session.id, studentId, session.subject_id, markedAt);

    res.status(201).json({
      message: 'Attendance marked Present.',
      details: {
        subject_code: session.subject_code,
        subject_name: session.subject_name,
        teacher_name: session.teacher_name,
        topic: session.topic,
        session_date: session.session_date,
        marked_at: markedAt,
      },
    });
  });

  app.get('/api/student/notices', requireAuth, requireRole('student'), (_req, res) => {
    const notices = db
      .prepare(
        `SELECT n.*, u.full_name AS author_name FROM notices n JOIN users u ON u.id = n.author_id
         WHERE n.target_role IN ('all', 'student') ORDER BY n.published_at DESC`
      )
      .all();
    res.json({ notices });
  });

  app.get('/api/student/leaves', requireAuth, requireRole('student'), (req: AuthRequest, res) => {
    const studentId = req.user!.student_id!;
    const leaves = db
      .prepare(
        `SELECT lr.*, sub.code AS subject_code, sub.name AS subject_name, u.full_name AS reviewer_name
         FROM leave_requests lr
         LEFT JOIN subjects sub ON sub.id = lr.subject_id
         LEFT JOIN teachers t ON t.id = lr.reviewed_by_teacher_id
         LEFT JOIN users u ON u.id = t.user_id
         WHERE lr.student_id = ?
         ORDER BY lr.created_at DESC`
      )
      .all(studentId);
    res.json({ leaves });
  });

  app.post('/api/student/leaves', requireAuth, requireRole('student'), (req: AuthRequest, res) => {
    const studentId = req.user!.student_id!;
    const { subject_id, from_date, to_date, reason } = req.body as {
      subject_id?: number | string;
      from_date?: string;
      to_date?: string;
      reason?: string;
    };

    if (!from_date || !to_date || !reason || reason.trim().length < 5) {
      res.status(400).json({ error: 'From date, to date, and a clear reason are required.' });
      return;
    }

    const r = db
      .prepare(
        `INSERT INTO leave_requests (student_id, subject_id, from_date, to_date, reason)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        studentId,
        subject_id ? Number(subject_id) : null,
        from_date,
        to_date,
        reason.trim()
      );
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  });

  // ==========================================
  // VITE / STATIC SERVING
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build not found.');
      }
    });
  }

  app.listen(3000, '0.0.0.0', () => {
    console.log('Smart ERP server listening on http://0.0.0.0:3000');
  });
}

startServer();
