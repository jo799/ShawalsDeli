import { Request, Response } from 'express';
import { query } from '../config/database';

// Every DATE(created_at) / GROUP BY DATE(created_at) / EXTRACT(HOUR FROM
// created_at) below relies on config/database.ts pinning every DB session to
// Africa/Nairobi. created_at columns are naive TIMESTAMPs, so
// CURRENT_TIMESTAMP writes them using whatever timezone the session happens
// to be in — DATE()/EXTRACT() themselves have no timezone awareness at all,
// they just read the literal stored value. Without that pin (verified: a
// UTC-default session wrote an order placed at 00:33 Nairobi time as 21:33
// the PREVIOUS day), every report here — including the Dashboard's Today's
// Sales and the hourly Sales Trend chart — would misattribute anything near
// midnight to the wrong calendar day or hour.

export const getDailyReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    // Validate date format before it reaches Postgres — a malformed date
    // string would produce an unhandled query error rather than a clear 400.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || isNaN(Date.parse(String(date)))) {
      res.status(400).json({ success: false, message: 'date must be in YYYY-MM-DD format' });
      return;
    }

    const salesRes = await query(`
      SELECT
        COALESCE(SUM(total), 0) as total_sales,
        COUNT(*) as total_orders,
        COALESCE(AVG(total), 0) as avg_order_value,
        COALESCE(SUM(discount), 0) as total_discounts,
        COALESCE(SUM(total) - SUM(discount), 0) as net_sales
      FROM orders
      WHERE DATE(created_at) = $1 AND status = 'completed'
    `, [date]);

    const categoryRes = await query(`
      SELECT mc.name as category, SUM(oi.total_price) as sales, COUNT(oi.id) as qty
      FROM order_items oi
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      JOIN menu_categories mc ON mi.category_id = mc.id
      JOIN orders o ON oi.order_id = o.id
      WHERE DATE(o.created_at) = $1 AND o.status = 'completed'
      GROUP BY mc.name ORDER BY sales DESC
    `, [date]);

    const paymentRes = await query(`
      SELECT payment_method, SUM(amount) as amount, COUNT(*) as count
      FROM payments p
      JOIN orders o ON p.order_id = o.id
      WHERE DATE(o.created_at) = $1 AND p.status = 'completed'
      GROUP BY payment_method
    `, [date]);

    const topItemsRes = await query(`
      SELECT oi.item_name, SUM(oi.quantity) as qty_sold, SUM(oi.total_price) as sales,
        mi.cost, SUM(oi.quantity * mi.cost) as total_cost,
        CASE WHEN SUM(oi.total_price) > 0 THEN ROUND(((SUM(oi.total_price) - SUM(oi.quantity * mi.cost)) / SUM(oi.total_price) * 100)::numeric, 0) ELSE 0 END as profit_margin
      FROM order_items oi
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      JOIN orders o ON oi.order_id = o.id
      WHERE DATE(o.created_at) = $1 AND o.status = 'completed'
      GROUP BY oi.item_name, mi.cost
      ORDER BY sales DESC LIMIT 10
    `, [date]);

    const hourlyRes = await query(`
      SELECT EXTRACT(HOUR FROM created_at) as hour, SUM(total) as sales, COUNT(*) as orders
      FROM orders
      WHERE DATE(created_at) = $1 AND status = 'completed'
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `, [date]);

    const stats = salesRes.rows[0];
    const cogsRes = await query(`
      SELECT COALESCE(SUM(oi.quantity * mi.cost), 0) as cogs
      FROM order_items oi
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      JOIN orders o ON oi.order_id = o.id
      WHERE DATE(o.created_at) = $1 AND o.status = 'completed'
    `, [date]);

    const cogs = parseFloat(cogsRes.rows[0].cogs);
    const net_sales = parseFloat(stats.net_sales);
    const gross_profit = net_sales - cogs;

    // node-postgres returns numeric/decimal aggregates (SUM, AVG) and bigint
    // aggregates (COUNT) as strings, not JS numbers — Postgres won't risk
    // silently losing precision by auto-converting. `summary` above already
    // accounted for this; these four row sets didn't, which is exactly what
    // produced "NaN%" wherever the frontend did arithmetic on them (e.g.
    // Dashboard's Sales by Category dividing by a concatenated string
    // instead of a number). Parsed here, once, so every consumer of this
    // endpoint gets real numbers.
    const by_category = categoryRes.rows.map(r => ({ category: r.category, sales: parseFloat(r.sales) || 0, qty: parseInt(r.qty) || 0 }));
    const by_payment = paymentRes.rows.map(r => ({ payment_method: r.payment_method, amount: parseFloat(r.amount) || 0, count: parseInt(r.count) || 0 }));
    const top_items = topItemsRes.rows.map(r => ({
      item_name: r.item_name, qty_sold: parseInt(r.qty_sold) || 0, sales: parseFloat(r.sales) || 0,
      cost: parseFloat(r.cost) || 0, total_cost: parseFloat(r.total_cost) || 0, profit_margin: parseFloat(r.profit_margin) || 0,
    }));
    const hourly = hourlyRes.rows.map(r => ({ hour: parseInt(r.hour), sales: parseFloat(r.sales) || 0, orders: parseInt(r.orders) || 0 }));

    res.json({
      success: true, data: {
        summary: {
          total_sales: parseFloat(stats.total_sales),
          total_orders: parseInt(stats.total_orders),
          avg_order_value: parseFloat(stats.avg_order_value),
          total_discounts: parseFloat(stats.total_discounts),
          net_sales,
          cogs,
          gross_profit,
          gross_profit_margin: net_sales > 0 ? Math.round((gross_profit / net_sales) * 100) : 0,
        },
        by_category,
        by_payment,
        top_items,
        hourly,
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getWeeklyReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(`
      SELECT DATE(created_at) as date, SUM(total) as sales, COUNT(*) as orders
      FROM orders
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' AND status = 'completed'
      GROUP BY DATE(created_at) ORDER BY date
    `);
    // Same string-vs-number issue as getDailyReport — parse once here.
    const data = result.rows.map(r => ({ date: r.date, sales: parseFloat(r.sales) || 0, orders: parseInt(r.orders) || 0 }));
    res.json({ success: true, data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getMonthlyReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;
    const result = await query(`
      SELECT DATE(created_at) as date, SUM(total) as sales, COUNT(*) as orders
      FROM orders
      WHERE EXTRACT(YEAR FROM created_at) = $1 AND EXTRACT(MONTH FROM created_at) = $2 AND status = 'completed'
      GROUP BY DATE(created_at) ORDER BY date
    `, [year, month]);
    const data = result.rows.map(r => ({ date: r.date, sales: parseFloat(r.sales) || 0, orders: parseInt(r.orders) || 0 }));
    res.json({ success: true, data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};