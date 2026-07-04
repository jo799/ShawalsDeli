import { Request, Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const getExpenses = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category_id, payment_method, start_date, end_date, search, page = 1, limit = 10 } = req.query;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (category_id) { conditions.push(`e.category_id = $${idx++}`); params.push(category_id); }
    if (payment_method) { conditions.push(`e.payment_method = $${idx++}`); params.push(payment_method); }
    if (start_date) { conditions.push(`e.expense_date >= $${idx++}`); params.push(start_date); }
    if (end_date) { conditions.push(`e.expense_date <= $${idx++}`); params.push(end_date); }
    if (search) { conditions.push(`(e.title ILIKE $${idx} OR e.vendor ILIKE $${idx})`); params.push(`%${search}%`); idx++; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);
    const countRes = await query(`SELECT COUNT(*), SUM(amount) as total FROM expenses e ${where}`, params);

    params.push(Number(limit), offset);
    const result = await query(`
      SELECT e.*, ec.name as category_name, ec.color as category_color, u.full_name as created_by_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN users u ON e.created_by = u.id
      ${where}
      ORDER BY e.expense_date DESC, e.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `, params);

    const byCategory = await query(`
      SELECT ec.name, ec.color, SUM(e.amount) as total, COUNT(*) as count
      FROM expenses e JOIN expense_categories ec ON e.category_id = ec.id
      ${where ? where.replace(/e\./g, 'e.') : ''}
      GROUP BY ec.name, ec.color ORDER BY total DESC
    `, params.slice(0, -2));

    res.json({
      success: true, data: result.rows,
      summary: { total: parseFloat(countRes.rows[0].total || '0'), count: parseInt(countRes.rows[0].count) },
      by_category: byCategory.rows,
      pagination: { total: parseInt(countRes.rows[0].count), page: Number(page), limit: Number(limit) }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createExpense = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, category_id, vendor, amount, payment_method, expense_date, reference_no, notes } = req.body;
    const result = await query(`
      INSERT INTO expenses (title, description, category_id, vendor, amount, payment_method, expense_date, reference_no, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [title, description, category_id, vendor, amount, payment_method, expense_date || new Date().toISOString().split('T')[0], reference_no, notes, req.user!.id]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateExpense = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, category_id, vendor, amount, payment_method, expense_date, reference_no, notes } = req.body;
    const result = await query(`
      UPDATE expenses SET title=$1, description=$2, category_id=$3, vendor=$4, amount=$5,
        payment_method=$6, expense_date=$7, reference_no=$8, notes=$9, updated_at=CURRENT_TIMESTAMP
      WHERE id=$10 RETURNING *
    `, [title, description, category_id, vendor, amount, payment_method, expense_date, reference_no, notes, id]);
    if (!result.rows.length) { res.status(404).json({ success: false, message: 'Expense not found' }); return; }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query('DELETE FROM expenses WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) { res.status(404).json({ success: false, message: 'Expense not found' }); return; }
    res.json({ success: true, message: 'Expense deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getExpenseCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query('SELECT * FROM expense_categories ORDER BY name');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
