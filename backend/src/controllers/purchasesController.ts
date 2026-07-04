import { Request, Response } from 'express';
import { query, getClient } from '../config/database';
import { AuthRequest } from '../middleware/auth';

// Uses timestamp + random suffix (same approach as order numbers) rather than
// COUNT(*)+1, which produces duplicates if any PO is ever deleted and races
// if two POs are created simultaneously.
const generatePONumber = (): string => {
  const ts = Date.now().toString().slice(-7);
  const rand = Math.floor(Math.random() * 90 + 10);
  return `PO-${ts}${rand}`;
};

export const getPurchaseOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, supplier_id, start_date, end_date, search, page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (status && status !== 'all') { conditions.push(`po.status = $${idx++}`); params.push(status); }
    if (supplier_id) { conditions.push(`po.supplier_id = $${idx++}`); params.push(supplier_id); }
    if (start_date) { conditions.push(`po.order_date >= $${idx++}`); params.push(start_date); }
    if (end_date) { conditions.push(`po.order_date <= $${idx++}`); params.push(end_date); }
    if (search) { conditions.push(`(po.po_number ILIKE $${idx} OR s.name ILIKE $${idx})`); params.push(`%${search}%`); idx++; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*) FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id ${where}`, params);

    params.push(Number(limit), offset);
    const result = await query(`
      SELECT po.*, s.name as supplier_name, s.phone as supplier_phone,
        CASE WHEN po.total_amount > 0 THEN
          ROUND((SELECT COALESCE(SUM(quantity_received), 0) FROM purchase_order_items WHERE purchase_order_id = po.id) /
          NULLIF((SELECT COALESCE(SUM(quantity_ordered), 0) FROM purchase_order_items WHERE purchase_order_id = po.id), 0) * 100)
        ELSE 0 END as received_percentage
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      ${where}
      ORDER BY po.order_date DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `, params);

    const statsRes = await query(`
      SELECT COUNT(*) as total_pos, SUM(total_amount) as total_spent,
        COUNT(*) FILTER (WHERE status='received') as received,
        COUNT(*) FILTER (WHERE status='pending') as pending,
        COUNT(*) FILTER (WHERE expected_date < CURRENT_DATE AND status NOT IN ('received','cancelled')) as overdue
      FROM purchase_orders WHERE EXTRACT(MONTH FROM order_date) = EXTRACT(MONTH FROM CURRENT_DATE)
    `);

    res.json({ success: true, data: result.rows, stats: statsRes.rows[0], pagination: { total: parseInt(countRes.rows[0].count), page: Number(page), limit: Number(limit) } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getPurchaseOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const poRes = await query(`
      SELECT po.*, s.name as supplier_name, s.phone as supplier_phone
      FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.id = $1
    `, [req.params.id]);
    if (!poRes.rows.length) { res.status(404).json({ success: false, message: 'Not found' }); return; }
    const itemsRes = await query('SELECT * FROM purchase_order_items WHERE purchase_order_id = $1', [req.params.id]);
    res.json({ success: true, data: { ...poRes.rows[0], items: itemsRes.rows } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createPurchaseOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { supplier_id, expected_date, items, notes, discount = 0 } = req.body;
    const po_number = generatePONumber();
    let subtotal = 0;
    for (const item of items) { subtotal += item.unit_price * item.quantity_ordered; }
    const total_amount = subtotal - discount;

    const poRes = await client.query(`
      INSERT INTO purchase_orders (po_number, supplier_id, expected_date, subtotal, discount, total_amount, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [po_number, supplier_id, expected_date, subtotal, discount, total_amount, notes, req.user!.id]);

    for (const item of items) {
      await client.query(`
        INSERT INTO purchase_order_items (purchase_order_id, inventory_item_id, item_name, unit, quantity_ordered, unit_price, total)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [poRes.rows[0].id, item.inventory_item_id || null, item.item_name, item.unit, item.quantity_ordered, item.unit_price, item.unit_price * item.quantity_ordered]);
    }
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: poRes.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

export const getSuppliers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query('SELECT * FROM suppliers WHERE is_active = true ORDER BY name');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
