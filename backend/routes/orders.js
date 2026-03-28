const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all orders (newest first)
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT o.*, 
             p.stock as product_stock,
             p.price as product_current_price
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      ORDER BY o.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET single order
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST create order (called by WhatsApp bot)
router.post('/', async (req, res) => {
  const {
    lead_id, customer_name, customer_phone,
    product_id, product_name, product_price,
    quantity = 1, payment_method = 'Cash', notes, receipt_data
  } = req.body;

  const total_amount = product_price * quantity;

  try {
    const { rows } = await db.query(`
      INSERT INTO orders 
        (lead_id, customer_name, customer_phone, product_id, product_name, product_price, quantity, total_amount, payment_method, notes, receipt_data)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [lead_id, customer_name, customer_phone, product_id, product_name, product_price, quantity, total_amount, payment_method, notes, JSON.stringify(receipt_data || {})]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT accept order → deduct inventory, record finance sale, update lead
router.put('/:id/accept', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Get the order
    const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = orderRes.rows[0];

    if (order.order_status !== 'Pending') {
      return res.status(400).json({ error: `Order is already ${order.order_status}` });
    }

    // 2. Check product stock
    if (order.product_id) {
      const prodRes = await db.query('SELECT * FROM products WHERE id = $1', [order.product_id]);
      const product = prodRes.rows[0];
      if (!product) return res.status(404).json({ error: 'Product not found' });
      if (product.stock < order.quantity) {
        return res.status(400).json({ error: `Insufficient stock. Available: ${product.stock}` });
      }

      // 3. Deduct inventory stock
      await db.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [order.quantity, order.product_id]
      );

      // 4. Record in product_sales (finance)
      await db.query(`
        INSERT INTO product_sales (product_id, lead_id, selling_price, sale_date, payment_method)
        VALUES ($1, $2, $3, CURRENT_DATE, $4)
      `, [order.product_id, order.lead_id, order.total_amount, order.payment_method]);

      // 5. Record in cash_flow
      await db.query(`
        INSERT INTO cash_flow (type, account, amount, description, date)
        VALUES ('Income', $1, $2, $3, CURRENT_DATE)
      `, [
        order.payment_method === 'Cash' ? 'Cash' : 'Bank',
        order.total_amount,
        `Order #${id} — ${order.product_name} x${order.quantity} (${order.customer_name})`
      ]);
    }

    // 6. Update lead status
    if (order.lead_id) {
      await db.query(
        "UPDATE leads SET status = 'Sale Completed' WHERE id = $1",
        [order.lead_id]
      );
    }

    // 7. Update order status
    const { rows } = await db.query(
      "UPDATE orders SET order_status = 'Accepted', payment_status = 'Paid', updated_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );

    res.json({ message: 'Order accepted successfully', order: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT reject order
router.put('/:id/reject', async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const { rows } = await db.query(
      "UPDATE orders SET order_status = 'Rejected', notes = COALESCE(notes,'') || $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [reason ? `\nRejected: ${reason}` : '', id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order rejected', order: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE order
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM orders WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
