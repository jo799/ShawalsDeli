import { Request, Response } from 'express';
import { query } from '../config/database';
import bcrypt from 'bcryptjs';

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
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await query(`
      INSERT INTO users (full_name, email, phone, password_hash, role, schedule_type, joined_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id, full_name, email, phone, role, status, schedule_type, joined_date, created_at
    `, [full_name, email.toLowerCase().trim(), phone, passwordHash, role, schedule_type || 'full_time', joined_date || new Date().toISOString().split('T')[0]]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { full_name, phone, role, status, schedule_type } = req.body;
    const result = await query(`
      UPDATE users SET full_name=$1, phone=$2, role=$3, status=$4, schedule_type=$5, updated_at=CURRENT_TIMESTAMP
      WHERE id=$6
      RETURNING id, full_name, email, phone, role, status, schedule_type, joined_date
    `, [full_name, phone, role, status, schedule_type, id]);
    if (!result.rows.length) { res.status(404).json({ success: false, message: 'Staff not found' }); return; }
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
      SELECT ss.*, u.full_name, u.role as user_role, u.avatar_url
      FROM staff_schedules ss
      JOIN users u ON ss.user_id = u.id
      WHERE ss.shift_date BETWEEN $1 AND $2
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
    const result = await query(`
      INSERT INTO staff_schedules (user_id, shift_date, shift_type, start_time, end_time, role_label)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (user_id, shift_date) DO UPDATE SET
        shift_type = EXCLUDED.shift_type, start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time, role_label = EXCLUDED.role_label, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [user_id, shift_date, shift_type, start_time, end_time, role_label]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
