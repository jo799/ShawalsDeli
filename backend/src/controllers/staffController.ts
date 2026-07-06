import { Request, Response } from 'express';
import { query } from '../config/database';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/auth';
import { isValidRole, isValidStatus, ROLES } from '../permissions';

export const getStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, status, search, page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (role && role !== 'all') { conditions.push(`role = $${idx++}`); params.push(role); }
    if (status && status !== 'all') { conditions.push(`status = $${idx++}`); params.push(status); }
    if (search) { conditions.push(`(full_name ILIKE $${idx} OR email ILIKE $${idx} OR phone ILIKE $${idx})`); params.push(`%${search}%`); idx++; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*) FROM users ${where}`, params);

    params.push(Number(limit), offset);
    const result = await query(`
      SELECT id, full_name, email, phone, role, status, schedule_type, avatar_url, joined_date, last_login, created_at
      FROM users ${where}
      ORDER BY joined_date DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `, params);

    const statsRes = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'on_leave') as on_leave,
        COUNT(*) FILTER (WHERE status = 'inactive') as inactive
      FROM users
    `);

    res.json({ success: true, data: result.rows, stats: statsRes.rows[0], pagination: { total: parseInt(countRes.rows[0].count), page: Number(page), limit: Number(limit) } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const { full_name, email, phone, role, schedule_type, joined_date, password } = req.body;
    if (!full_name || !email || !password) {
      res.status(400).json({ success: false, message: 'full_name, email and password are required' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
      return;
    }
    const staffRole = role || 'waiter';
    if (!isValidRole(staffRole)) {
      res.status(400).json({ success: false, message: `Invalid role. Must be one of: ${ROLES.join(', ')}` });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await query(`
      INSERT INTO users (full_name, email, phone, password_hash, role, schedule_type, joined_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id, full_name, email, phone, role, status, schedule_type, joined_date, created_at
    `, [full_name, email.toLowerCase().trim(), phone, passwordHash, staffRole, schedule_type || 'full_time', joined_date || new Date().toISOString().split('T')[0]]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateStaff = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { full_name, phone, role, status, schedule_type } = req.body;

    if (role !== undefined && !isValidRole(role)) {
      res.status(400).json({ success: false, message: `Invalid role. Must be one of: ${ROLES.join(', ')}` });
      return;
    }
    if (status !== undefined && !isValidStatus(status)) {
      res.status(400).json({ success: false, message: 'Invalid status. Must be active, inactive, or on_leave' });
      return;
    }

    if (req.user?.id === id && (role !== undefined || status !== undefined)) {
      res.status(400).json({ success: false, message: 'You cannot change your own role or status' });
      return;
    }

    const existing = await query('SELECT id, full_name, email, phone, role, status, schedule_type FROM users WHERE id = $1', [id]);
    if (!existing.rows.length) {
      res.status(404).json({ success: false, message: 'Staff not found' });
      return;
    }

    const current = existing.rows[0];
    const result = await query(`
      UPDATE users SET full_name=$1, phone=$2, role=$3, status=$4, schedule_type=$5, updated_at=CURRENT_TIMESTAMP
      WHERE id=$6
      RETURNING id, full_name, email, phone, role, status, schedule_type, joined_date
    `, [
      full_name ?? current.full_name,
      phone ?? current.phone,
      role ?? current.role,
      status ?? current.status,
      schedule_type ?? current.schedule_type,
      id,
    ]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getSchedules = async (req: Request, res: Response): Promise<void> => {
  try {
    const { start_date, end_date } = req.query;
    const result = await query(`
      SELECT ss.id, ss.user_id,
        to_char(ss.shift_date, 'YYYY-MM-DD') AS shift_date,
        ss.shift_type, ss.start_time, ss.end_time, ss.role_label,
        ss.created_by, ss.created_at, ss.updated_at,
        u.full_name, u.role as user_role, u.avatar_url
      FROM staff_schedules ss
      JOIN users u ON ss.user_id = u.id
      WHERE ss.shift_date BETWEEN $1::date AND $2::date
      ORDER BY ss.shift_date, u.full_name
    `, [start_date || new Date().toISOString().split('T')[0], end_date || new Date().toISOString().split('T')[0]]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const upsertSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { user_id, shift_date, shift_type, start_time, end_time, role_label } = req.body;
    if (!user_id || !shift_date || !shift_type) {
      res.status(400).json({ success: false, message: 'user_id, shift_date and shift_type are required' });
      return;
    }
    const validShifts = ['morning', 'day', 'evening', 'night', 'off'];
    if (!validShifts.includes(shift_type)) {
      res.status(400).json({ success: false, message: `Invalid shift_type. Must be one of: ${validShifts.join(', ')}` });
      return;
    }
    const dateOnly = String(shift_date).slice(0, 10);
    const result = await query(`
      INSERT INTO staff_schedules (user_id, shift_date, shift_type, start_time, end_time, role_label)
      VALUES ($1, $2::date, $3, $4, $5, $6)
      ON CONFLICT (user_id, shift_date) DO UPDATE SET
        shift_type = EXCLUDED.shift_type, start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time, role_label = EXCLUDED.role_label, updated_at = CURRENT_TIMESTAMP
      RETURNING id, user_id, to_char(shift_date, 'YYYY-MM-DD') AS shift_date, shift_type, start_time, end_time, role_label, created_at, updated_at
    `, [user_id, dateOnly, shift_type, start_time || null, end_time || null, role_label || null]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
