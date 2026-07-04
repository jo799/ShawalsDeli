import { Request, Response } from 'express';
import { query } from '../config/database';

export const getCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (search) { conditions.push(`(c.full_name ILIKE $${idx} OR c.phone ILIKE $${idx} OR c.email ILIKE $${idx})`); params.push(`%${search}%`); idx++; }
    if (status) { conditions.push(`c.status = $${idx++}`); params.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*) FROM customers c ${where}`, params);

    params.push(Number(limit), offset);
    const result = await query(`
      SELECT c.*,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(o.total), 0) as total_spent,
        MAX(o.created_at) as last_visit,
        lp.total_points, lp.available_points,
        lt.name as loyalty_tier
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'completed'
      LEFT JOIN loyalty_points lp ON lp.customer_id = c.id
      LEFT JOIN loyalty_tiers lt ON lp.tier_id = lt.id
      ${where}
      GROUP BY c.id, lp.total_points, lp.available_points, lt.name
      ORDER BY c.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `, params);

    res.json({ success: true, data: result.rows, pagination: { total: parseInt(countRes.rows[0].count), page: Number(page), limit: Number(limit) } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getCustomerById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const custRes = await query(`
      SELECT c.*,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(o.total), 0) as total_spent,
        MAX(o.created_at) as last_visit,
        lp.total_points, lp.available_points,
        lt.name as loyalty_tier
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'completed'
      LEFT JOIN loyalty_points lp ON lp.customer_id = c.id
      LEFT JOIN loyalty_tiers lt ON lp.tier_id = lt.id
      WHERE c.id = $1
      GROUP BY c.id, lp.total_points, lp.available_points, lt.name
    `, [id]);

    if (!custRes.rows.length) { res.status(404).json({ success: false, message: 'Customer not found' }); return; }

    const recentOrders = await query(`SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 5`, [id]);

    res.json({ success: true, data: { ...custRes.rows[0], recent_orders: recentOrders.rows } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { full_name, phone, email, address, city, tags, is_vip, credit_limit, notes } = req.body;
    if (!full_name || !full_name.toString().trim()) {
      res.status(400).json({ success: false, message: 'full_name is required' });
      return;
    }
    const ts = Date.now().toString().slice(-6);
    const rand = Math.floor(Math.random() * 900 + 100);
    const code = `CUS-${ts}${rand}`;
    const result = await query(`
      INSERT INTO customers (customer_code, full_name, phone, email, address, city, tags, is_vip, credit_limit, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [code, full_name.toString().trim(), phone, email, address, city, tags || [], is_vip || false, credit_limit || 0, notes]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { full_name, phone, email, address, city, tags, is_vip, credit_limit, notes, status,
            sms_notifications, email_notifications, whatsapp_notifications, marketing_offers } = req.body;
    const result = await query(`
      UPDATE customers SET full_name=$1, phone=$2, email=$3, address=$4, city=$5, tags=$6,
        is_vip=$7, credit_limit=$8, notes=$9, status=$10, sms_notifications=$11,
        email_notifications=$12, whatsapp_notifications=$13, marketing_offers=$14, updated_at=CURRENT_TIMESTAMP
      WHERE id=$15 RETURNING *
    `, [full_name, phone, email, address, city, tags, is_vip, credit_limit, notes, status,
        sms_notifications, email_notifications, whatsapp_notifications, marketing_offers, id]);
    if (!result.rows.length) { res.status(404).json({ success: false, message: 'Customer not found' }); return; }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
