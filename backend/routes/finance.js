const express = require('express');
const router = express.Router();
const db = require('../db');

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function dateRange(from, to) {
  const f = from || '2000-01-01';
  const t = to   || new Date().toISOString().split('T')[0];
  return { f, t };
}

// ─── OVERVIEW (supports ?from=YYYY-MM-DD&to=YYYY-MM-DD) ──────────────────────
router.get('/overview', async (req, res) => {
  try {
    const { f, t } = dateRange(req.query.from, req.query.to);

    const [
      totalIncomeRes, todayIncomeRes, monthIncomeRes,
      prevPeriodIncome,                       // for growth rate
      totalExpenses, periodExpenses,
      prevPeriodExpenses,
      orderRevenue,
      balances, incomeByMonth, expByCategory,
      orderCountRes
    ] = await Promise.all([
      // Period income (cash_flow)
      db.query(
        "SELECT COALESCE(SUM(amount),0) as total FROM cash_flow WHERE type='Income' AND date BETWEEN $1 AND $2",
        [f, t]
      ),
      // Today's income
      db.query("SELECT COALESCE(SUM(amount),0) as total FROM cash_flow WHERE type='Income' AND date=CURRENT_DATE"),
      // This month's income
      db.query("SELECT COALESCE(SUM(amount),0) as total FROM cash_flow WHERE type='Income' AND date>=date_trunc('month',CURRENT_DATE)"),
      // Previous period income (same duration, before `f`) for growth rate
      db.query(`
        SELECT COALESCE(SUM(amount),0) as total FROM cash_flow
        WHERE type='Income'
          AND date BETWEEN ($1::date - ($2::date - $1::date)) AND ($1::date - INTERVAL '1 day')
      `, [f, t]),
      // All-time total expenses
      db.query("SELECT COALESCE(SUM(amount),0) as total FROM expenses"),
      // Period expenses
      db.query(
        "SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE date BETWEEN $1 AND $2",
        [f, t]
      ),
      // Previous period expenses
      db.query(`
        SELECT COALESCE(SUM(amount),0) as total FROM expenses
        WHERE date BETWEEN ($1::date - ($2::date - $1::date)) AND ($1::date - INTERVAL '1 day')
      `, [f, t]),
      // Order revenue (accepted orders in period)
      db.query(
        "SELECT COALESCE(SUM(total_amount),0) as total, COUNT(*) as count FROM orders WHERE order_status='Accepted' AND created_at::date BETWEEN $1 AND $2",
        [f, t]
      ),
      // Live balances (always all-time for Bank/Cash)
      db.query("SELECT account, COALESCE(SUM(CASE WHEN type='Income' THEN amount ELSE -amount END),0) as balance FROM cash_flow GROUP BY account"),
      // Monthly trend for chart (last 12 months or full period)
      db.query(`
        SELECT TO_CHAR(date_trunc('month', date), 'Mon YY') as month,
               TO_CHAR(date_trunc('month', date), 'YYYY-MM') as month_key,
               COALESCE(SUM(CASE WHEN type='Income'  THEN amount ELSE 0 END),0) as revenue,
               COALESCE(SUM(CASE WHEN type='Expense' THEN amount ELSE 0 END),0) as expenses
        FROM cash_flow
        WHERE date >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY date_trunc('month', date)
        ORDER BY date_trunc('month', date)
      `),
      // Expense breakdown by category
      db.query(`
        SELECT category, COALESCE(SUM(amount),0) as total
        FROM expenses WHERE date BETWEEN $1 AND $2
        GROUP BY category ORDER BY total DESC LIMIT 8
      `, [f, t]),
      // Order count in period
      db.query(
        "SELECT COUNT(*) as count FROM orders WHERE created_at::date BETWEEN $1 AND $2",
        [f, t]
      ),
    ]);

    const totalRevenue = parseFloat(totalIncomeRes.rows[0].total);
    const prevRevenue  = parseFloat(prevPeriodIncome.rows[0].total);
    const periodExp    = parseFloat(periodExpenses.rows[0].total);
    const prevExp      = parseFloat(prevPeriodExpenses.rows[0].total);
    const netProfit    = totalRevenue - periodExp;
    const allTimeExp   = parseFloat(totalExpenses.rows[0].total);
    const orderRev     = parseFloat(orderRevenue.rows[0].total);
    const orderCount   = parseInt(orderRevenue.rows[0].count);
    const totalOrderCount = parseInt(orderCountRes.rows[0].count);

    // Growth rates (vs previous equally-sized period)
    const revenueGrowth = prevRevenue > 0
      ? (((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1)
      : null;
    const expenseGrowth = prevExp > 0
      ? (((periodExp - prevExp) / prevExp) * 100).toFixed(1)
      : null;
    const profitMargin = totalRevenue > 0
      ? ((netProfit / totalRevenue) * 100).toFixed(1)
      : '0.0';
    const orderConversion = totalOrderCount > 0
      ? ((orderCount / totalOrderCount) * 100).toFixed(1)
      : '0.0';
    const avgOrderValue = orderCount > 0
      ? (orderRev / orderCount).toFixed(2)
      : '0.00';

    res.json({
      // Period stats (date-filtered)
      periodRevenue: totalRevenue,
      periodExpenses: periodExp,
      netProfit,
      profitMargin,
      orderRevenue: orderRev,
      orderCount,
      avgOrderValue,
      orderConversion,
      revenueGrowth,
      expenseGrowth,
      // Always today / month
      todaySales: todayIncomeRes.rows[0].total,
      monthSales: monthIncomeRes.rows[0].total,
      // All-time totals
      totalRevenue,
      totalExpenses: allTimeExp,
      // Balance cards (live)
      balances: balances.rows,
      // Chart data
      incomeByMonth: incomeByMonth.rows,
      expByCategory: expByCategory.rows,
      // Date range used
      dateFrom: f,
      dateTo: t,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

// ─── RESET ALL FINANCIAL DATA (owner only) ────────────────────────────────────
router.delete('/reset', async (req, res) => {
  const { confirm } = req.body;
  if (confirm !== 'RESET_FINANCE') {
    return res.status(400).json({ error: 'Confirmation required. Send { confirm: "RESET_FINANCE" }' });
  }
  try {
    await db.query('BEGIN');
    await db.query('DELETE FROM cash_flow');
    await db.query('DELETE FROM expenses');
    await db.query('DELETE FROM income_entries');
    await db.query('DELETE FROM product_sales');
    await db.query('DELETE FROM orders');
    await db.query('COMMIT');
    res.json({ message: 'All financial data has been reset successfully.' });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Reset failed', detail: err.message });
  }
});

// ─── BALANCE ADJUSTMENT ───────────────────────────────────────────────────────
router.post('/balance/adjust', async (req, res) => {
  const { account, amount, type, description } = req.body;
  if (!['Bank', 'Cash'].includes(account)) return res.status(400).json({ error: 'Invalid account' });
  if (!amount || isNaN(Number(amount))) return res.status(400).json({ error: 'Invalid amount' });
  const flowType = type === 'remove' ? 'Expense' : 'Income';
  const desc = description || (type === 'remove' ? `Manual withdrawal from ${account}` : `Manual deposit to ${account}`);
  try {
    await db.query(
      "INSERT INTO cash_flow (type, account, amount, description, date) VALUES ($1,$2,$3,$4,CURRENT_DATE)",
      [flowType, account, Math.abs(Number(amount)), desc]
    );
    const { rows } = await db.query(
      "SELECT COALESCE(SUM(CASE WHEN type='Income' THEN amount ELSE -amount END),0) as balance FROM cash_flow WHERE account=$1",
      [account]
    );
    res.json({ message: 'Balance updated', balance: rows[0].balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── BALANCE HISTORY ──────────────────────────────────────────────────────────
router.get('/balance/:account', async (req, res) => {
  const { account } = req.params;
  try {
    const { rows } = await db.query(
      "SELECT * FROM cash_flow WHERE account=$1 ORDER BY date DESC, created_at DESC LIMIT 100",
      [account]
    );
    const balRes = await db.query(
      "SELECT COALESCE(SUM(CASE WHEN type='Income' THEN amount ELSE -amount END),0) as balance FROM cash_flow WHERE account=$1",
      [account]
    );
    res.json({ transactions: rows, balance: balRes.rows[0].balance });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── INCOME ───────────────────────────────────────────────────────────────────
router.get('/income', async (req, res) => {
  const { from, to } = req.query;
  try {
    let query = "SELECT * FROM income_entries";
    const params = [];
    if (from && to) {
      query += " WHERE date BETWEEN $1 AND $2";
      params.push(from, to);
    }
    query += " ORDER BY date DESC";
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { res.json([]); }
});

router.post('/income', async (req, res) => {
  const { category, amount, description, date, account } = req.body;
  try {
    let rows;
    try {
      const result = await db.query(
        "INSERT INTO income_entries (category, amount, description, date, account) VALUES ($1,$2,$3,$4,$5) RETURNING *",
        [category, amount, description || '', date || new Date(), account || 'Bank']
      );
      rows = result.rows;
    } catch (e) {
      await db.query(`CREATE TABLE IF NOT EXISTS income_entries (
        id SERIAL PRIMARY KEY, category VARCHAR(100) NOT NULL,
        amount NUMERIC(15,2) NOT NULL, description TEXT,
        date DATE DEFAULT CURRENT_DATE, account VARCHAR(50) DEFAULT 'Bank',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      const result = await db.query(
        "INSERT INTO income_entries (category, amount, description, date, account) VALUES ($1,$2,$3,$4,$5) RETURNING *",
        [category, amount, description || '', date || new Date(), account || 'Bank']
      );
      rows = result.rows;
    }
    await db.query(
      "INSERT INTO cash_flow (type, account, amount, description, date) VALUES ('Income',$1,$2,$3,$4)",
      [account || 'Bank', amount, `${category}: ${description || ''}`, date || new Date()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/income/:id', async (req, res) => {
  try {
    await db.query("DELETE FROM income_entries WHERE id=$1", [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ─── EXPENSES ─────────────────────────────────────────────────────────────────
router.get('/expenses', async (req, res) => {
  const { from, to } = req.query;
  try {
    let query = "SELECT * FROM expenses";
    const params = [];
    if (from && to) {
      query += " WHERE date BETWEEN $1 AND $2";
      params.push(from, to);
    }
    query += " ORDER BY date DESC";
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/expenses', async (req, res) => {
  const { category, amount, description, date, account } = req.body;
  try {
    const { rows } = await db.query(
      "INSERT INTO expenses (category, amount, description, date) VALUES ($1,$2,$3,$4) RETURNING *",
      [category, amount, description, date || new Date()]
    );
    await db.query(
      "INSERT INTO cash_flow (type, account, amount, description, date) VALUES ('Expense',$1,$2,$3,$4)",
      [account || 'Cash', amount, `${category}: ${description}`, date || new Date()]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/expenses/:id', async (req, res) => {
  try {
    await db.query("DELETE FROM expenses WHERE id=$1", [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ─── PRODUCT SALES ────────────────────────────────────────────────────────────
router.get('/sales', async (req, res) => {
  const { from, to } = req.query;
  try {
    let q = `SELECT ps.*, p.brand as product_name, p.purchase_price, p.transport_cost, p.repair_cost, p.registration_fee,
               (ps.selling_price - COALESCE(p.purchase_price,0) - COALESCE(p.transport_cost,0) - COALESCE(p.repair_cost,0) - COALESCE(p.registration_fee,0)) as profit
             FROM product_sales ps JOIN products p ON ps.product_id = p.id`;
    const params = [];
    if (from && to) { q += " WHERE ps.sale_date BETWEEN $1 AND $2"; params.push(from, to); }
    q += " ORDER BY ps.sale_date DESC";
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/sales', async (req, res) => {
  const { product_id, lead_id, selling_price, sale_date, payment_method, account } = req.body;
  try {
    const { rows } = await db.query(
      "INSERT INTO product_sales (product_id, lead_id, selling_price, sale_date, payment_method) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [product_id, lead_id, selling_price, sale_date || new Date(), payment_method]
    );
    await db.query("UPDATE products SET stock = stock - 1 WHERE id=$1", [product_id]);
    await db.query(
      "INSERT INTO cash_flow (type, account, amount, description, date) VALUES ('Income',$1,$2,$3,$4)",
      [account || 'Bank', selling_price, `Product Sale #${product_id}`, sale_date || new Date()]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ─── CASH FLOW ────────────────────────────────────────────────────────────────
router.get('/cashflow', async (req, res) => {
  const { from, to } = req.query;
  try {
    let q = "SELECT * FROM cash_flow";
    const params = [];
    if (from && to) { q += " WHERE date BETWEEN $1 AND $2"; params.push(from, to); }
    q += " ORDER BY date DESC, created_at DESC LIMIT 200";
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
