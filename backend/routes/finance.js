const express = require('express');
const router = express.Router();
const db = require('../db');

// Get financial overview
router.get('/overview', async (req, res) => {
  try {
    // Today's Sales
    const todaySales = await db.query("SELECT SUM(selling_price) as total FROM product_sales WHERE sale_date = CURRENT_DATE");
    // Monthly Sales
    const monthSales = await db.query("SELECT SUM(selling_price) as total FROM product_sales WHERE sale_date >= date_trunc('month', CURRENT_DATE)");
    
    // Total Expenses
    const expenses = await db.query("SELECT SUM(amount) as total FROM expenses");
    
    // Cash & Bank (summarized from cash_flow)
    const balances = await db.query("SELECT account, SUM(CASE WHEN type = 'Income' THEN amount ELSE -amount END) as balance FROM cash_flow GROUP BY account");
    
    res.json({
      todaySales: todaySales.rows[0].total || 0,
      monthSales: monthSales.rows[0].total || 0,
      totalExpenses: expenses.rows[0].total || 0,
      balances: balances.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Records
router.get('/expenses', async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM expenses ORDER BY date DESC");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/expenses', async (req, res) => {
  const { category, amount, description, date, account } = req.body;
  try {
    const { rows } = await db.query(
      "INSERT INTO expenses (category, amount, description, date) VALUES ($1, $2, $3, $4) RETURNING *",
      [category, amount, description, date || new Date()]
    );
    // Also record in cash flow
    await db.query(
      "INSERT INTO cash_flow (type, account, amount, description, date) VALUES ('Expense', $1, $2, $3, $4)",
      [account || 'Cash', amount, `Expense: ${category} - ${description}`, date || new Date()]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/sales', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT ps.*, p.brand, p.purchase_price, p.transport_cost, p.repair_cost, p.registration_fee 
      FROM product_sales ps 
      JOIN products p ON ps.product_id = p.id 
      ORDER BY ps.sale_date DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/sales', async (req, res) => {
  const { product_id, lead_id, selling_price, sale_date, payment_method, account } = req.body;
  try {
    const { rows } = await db.query(
      "INSERT INTO product_sales (product_id, lead_id, selling_price, sale_date, payment_method) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [product_id, lead_id, selling_price, sale_date || new Date(), payment_method]
    );
    // Reduced stock
    await db.query("UPDATE products SET stock = stock - 1 WHERE id = $1", [product_id]);
    // Record in cash flow
    await db.query(
      "INSERT INTO cash_flow (type, account, amount, description, date) VALUES ('Income', $1, $2, $3, $4)",
      [account || 'Bank', selling_price, `Product Sale ID: ${product_id}`, sale_date || new Date()]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
