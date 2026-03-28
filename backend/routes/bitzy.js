const express = require('express');
const router = express.Router();
const db = require('../db');

async function getBusinessContext() {
  const [ordersRes, leadsRes, productsRes, incomeRes, expensesRes, cashflowRes] = await Promise.all([
    db.query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200"),
    db.query("SELECT * FROM leads ORDER BY created_at DESC LIMIT 200"),
    db.query("SELECT * FROM products ORDER BY created_at DESC LIMIT 100"),
    db.query("SELECT * FROM income_entries ORDER BY date DESC LIMIT 100").catch(() => ({ rows: [] })),
    db.query("SELECT * FROM expenses ORDER BY date DESC LIMIT 100").catch(() => ({ rows: [] })),
    db.query("SELECT * FROM cash_flow ORDER BY date DESC LIMIT 200").catch(() => ({ rows: [] })),
  ]);

  const orders   = ordersRes.rows;
  const leads    = leadsRes.rows;
  const products = productsRes.rows;
  const expenses = expensesRes.rows;
  const cashflow = cashflowRes.rows;

  const accepted  = orders.filter(o => o.order_status === 'Accepted');
  const pending   = orders.filter(o => o.order_status === 'Pending');
  const rejected  = orders.filter(o => o.order_status === 'Rejected');
  const orderRevenue  = accepted.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const avgOrderValue = accepted.length > 0 ? orderRevenue / accepted.length : 0;
  const conversionRate = orders.length > 0 ? (accepted.length / orders.length * 100).toFixed(1) : '0';

  const hotLeads  = leads.filter(l => l.status === 'Hot' || l.status === 'Warm').length;
  const saleLeads = leads.filter(l => l.status === 'Sale Completed').length;

  const totalIncome   = cashflow.filter(c => c.type === 'Income').reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalExpenses = cashflow.filter(c => c.type === 'Expense').reduce((s, c) => s + Number(c.amount || 0), 0);
  const netProfit     = totalIncome - totalExpenses;
  const profitMargin  = totalIncome > 0 ? (netProfit / totalIncome * 100).toFixed(1) : '0';
  const bankBalance   = cashflow.filter(c => c.account === 'Bank').reduce((s, c) => s + (c.type === 'Income' ? Number(c.amount) : -Number(c.amount)), 0);
  const cashBalance   = cashflow.filter(c => c.account === 'Cash').reduce((s, c) => s + (c.type === 'Income' ? Number(c.amount) : -Number(c.amount)), 0);

  const lowStock   = products.filter(p => Number(p.stock || 0) <= 3);
  const outOfStock = products.filter(p => Number(p.stock || 0) === 0);
  const totalStock = products.reduce((s, p) => s + Number(p.stock || 0), 0);

  const productRevMap = {};
  accepted.forEach(o => {
    const key = o.product_name || 'Unknown';
    if (!productRevMap[key]) productRevMap[key] = { count: 0, revenue: 0 };
    productRevMap[key].count++;
    productRevMap[key].revenue += Number(o.total_amount || 0);
  });
  const topProducts = Object.entries(productRevMap)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([name, d]) => ({ name, count: d.count, revenue: d.revenue }));

  const cutoff7  = new Date(); cutoff7.setDate(cutoff7.getDate() - 7);
  const cutoff30 = new Date(); cutoff30.setDate(cutoff30.getDate() - 30);
  const last7    = orders.filter(o => new Date(o.created_at) >= cutoff7);
  const last30   = orders.filter(o => new Date(o.created_at) >= cutoff30);
  const l7Rev    = last7.filter(o => o.order_status === 'Accepted').reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const dailyAvg = l7Rev / 7;

  const monthlyMap = {};
  cashflow.filter(c => c.type === 'Income').forEach(c => {
    const m = String(c.date || '').substring(0, 7);
    if (m && m.length >= 7) monthlyMap[m] = (monthlyMap[m] || 0) + Number(c.amount);
  });
  const monthlyTrend = Object.entries(monthlyMap).sort().slice(-6).map(([m, v]) => ({ month: m, income: v }));
  const trendGrowth = monthlyTrend.length >= 2
    ? (((monthlyTrend[monthlyTrend.length - 1].income - monthlyTrend[monthlyTrend.length - 2].income) / (monthlyTrend[monthlyTrend.length - 2].income || 1)) * 100).toFixed(1)
    : null;

  const expCat = {};
  expenses.forEach(e => { expCat[e.category] = (expCat[e.category] || 0) + Number(e.amount); });
  const topExpCategories = Object.entries(expCat).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return {
    summary: {
      totalOrders: orders.length, accepted: accepted.length, pending: pending.length, rejected: rejected.length,
      orderRevenue, avgOrderValue, conversionRate,
      totalLeads: leads.length, hotLeads, saleLeads,
      totalIncome, totalExpenses, netProfit, profitMargin, bankBalance, cashBalance,
      totalProducts: products.length, lowStock: lowStock.length, outOfStock: outOfStock.length, totalStock,
    },
    predictions: {
      weeklyForecast: dailyAvg * 7,
      monthForecast: dailyAvg * 30,
      dailyAvg,
      last7Days: last7.length, last30Days: last30.length,
      l7Revenue: l7Rev, trendGrowth,
    },
    details: {
      topProducts,
      lowStockProducts: lowStock.map(p => ({ name: p.brand, stock: p.stock })),
      topExpCategories,
      monthlyTrend,
      recentOrders: accepted.slice(0, 5).map(o => ({ id: o.id, name: o.customer_name, product: o.product_name, amount: o.total_amount, date: o.created_at })),
    }
  };
}

function fmt(n) {
  return `Rs. ${Number(n || 0).toLocaleString()}`;
}

function generateAnswer(question, ctx) {
  const q = question.toLowerCase();
  const s = ctx.summary;
  const p = ctx.predictions;
  const d = ctx.details;

  if (q.match(/revenue|income|earn|how much.*made|total.*money/)) {
    return `📊 **Revenue Overview**\n\nYour total all-time income is **${fmt(s.totalIncome)}** with total expenses of **${fmt(s.totalExpenses)}**, giving you a net profit of **${fmt(s.netProfit)}** (${s.profitMargin}% margin).\n\nFrom WhatsApp orders alone, you've earned **${fmt(s.orderRevenue)}** across ${s.accepted} accepted orders.\n\n${p.trendGrowth !== null ? `📈 Month-over-month revenue trend: **${p.trendGrowth}%**` : ''}`;
  }

  if (q.match(/forecast|predict|next week|next month|expect|projection/)) {
    return `🔮 **Business Forecast**\n\nBased on your last 7 days:\n- **Daily average revenue:** ${fmt(p.dailyAvg)}\n- **Next 7-day forecast:** ${fmt(p.weeklyForecast)}\n- **Next 30-day forecast:** ${fmt(p.monthForecast)}\n\n${p.trendGrowth !== null ? `Trend: **${p.trendGrowth}%** — ${Number(p.trendGrowth) > 0 ? 'Growing! 📈' : 'Needs attention 📉'}` : ''}\n\n💡 Focus on **${d.topProducts[0]?.name || 'your best product'}** to maximize revenue.`;
  }

  if (q.match(/order|orders|how many order/)) {
    return `📦 **Orders Summary**\n\n- Total: **${s.totalOrders}** | Accepted: **${s.accepted}** | Pending: **${s.pending}** | Rejected: **${s.rejected}**\n- Conversion rate: **${s.conversionRate}%**\n- Avg value: **${fmt(s.avgOrderValue)}**\n- Last 7 days: **${p.last7Days}** orders\n\n${s.pending > 0 ? `⚠️ **${s.pending} orders awaiting your approval!**` : '✅ All orders processed!'}`;
  }

  if (q.match(/lead|leads|customer|prospect/)) {
    const rate = s.totalLeads > 0 ? (s.saleLeads / s.totalLeads * 100).toFixed(1) : 0;
    return `👥 **Leads Pipeline**\n\n- Total leads: **${s.totalLeads}**\n- Hot/Warm: **${s.hotLeads}**\n- Converted: **${s.saleLeads}** (${rate}%)\n\n💡 ${s.hotLeads > 0 ? `Follow up with your **${s.hotLeads} warm leads** now!` : 'Generate more leads through marketing.'}\n\nRecent customers: ${d.recentOrders.slice(0, 3).map(o => o.name).filter(Boolean).join(', ') || 'None yet'}.`;
  }

  if (q.match(/expense|cost|spend|overhead/)) {
    const topExp = d.topExpCategories[0];
    return `💸 **Expense Analysis**\n\nTotal: **${fmt(s.totalExpenses)}**\n\nTop categories:\n${d.topExpCategories.map((c, i) => `${i + 1}. **${c[0]}** — ${fmt(c[1])}`).join('\n')}\n\n${topExp ? `⚠️ Biggest cost: **${topExp[0]}** at **${fmt(topExp[1])}** (${(topExp[1] / s.totalExpenses * 100).toFixed(1)}% of total)` : ''}`;
  }

  if (q.match(/product|inventory|stock|item/)) {
    const lowP = d.lowStockProducts.slice(0, 3).map(p => `${p.name} (${p.stock} left)`).join(', ');
    return `📦 **Inventory**\n\n- Products: **${s.totalProducts}** | Stock units: **${s.totalStock}**\n- Low stock: **${s.lowStock}** | Out of stock: **${s.outOfStock}**\n\n${s.lowStock > 0 ? `⚠️ Restock: **${lowP}**` : '✅ All products well stocked!'}\n\n🔥 **Top sellers:**\n${d.topProducts.slice(0, 3).map((p, i) => `${i + 1}. ${p.name} — ${p.count} sold, ${fmt(p.revenue)}`).join('\n')}`;
  }

  if (q.match(/profit|margin|loss|break.?even/)) {
    const isProfit = s.netProfit >= 0;
    return `💹 **Profit & Loss**\n\n- Revenue: **${fmt(s.totalIncome)}**\n- Expenses: **${fmt(s.totalExpenses)}**\n- **Net ${isProfit ? 'Profit' : 'Loss'}: ${fmt(Math.abs(s.netProfit))}** ${isProfit ? '✅' : '🔴'}\n- Margin: **${s.profitMargin}%**\n\n${isProfit ? `Great job — you're profitable!` : `⚠️ Operating at a loss. Biggest cost: ${d.topExpCategories[0]?.[0] || 'N/A'}`}`;
  }

  if (q.match(/balance|bank|cash|wallet|fund/)) {
    return `🏦 **Balances**\n\n- **Bank:** ${fmt(s.bankBalance)} ${s.bankBalance < 0 ? '⚠️' : '✅'}\n- **Cash:** ${fmt(s.cashBalance)} ${s.cashBalance < 0 ? '⚠️' : '✅'}\n- **Total Liquid:** ${fmt(s.bankBalance + s.cashBalance)}`;
  }

  if (q.match(/best|top|popular|highest|performance/)) {
    if (d.topProducts.length === 0) return `📊 No order data yet. Once orders come in, I'll identify top performers!`;
    return `🏆 **Top Products**\n\n${d.topProducts.map((p, i) => `${['🥇','🥈','🥉','4️⃣','5️⃣'][i]} **${p.name}** — ${p.count} orders · ${fmt(p.revenue)}`).join('\n')}\n\n💡 Stock up on **${d.topProducts[0].name}** — it drives the most revenue!`;
  }

  if (q.match(/whatsapp|bot|chatbot/)) {
    return `🤖 **WhatsApp Bot Performance**\n\n- Orders generated: **${s.totalOrders}**\n- Accepted: **${s.accepted}** (${s.conversionRate}%)\n- Pending: **${s.pending}**\n- Bot revenue: **${fmt(s.orderRevenue)}**\n\n${s.pending > 0 ? `⚠️ Reply to **${s.pending} pending orders** to increase revenue!` : '✅ All bot orders are processed!'}`;
  }

  // Default overview
  return `📊 **Business Snapshot**\n\n**💰 Finance:** Revenue ${fmt(s.totalIncome)} | Expenses ${fmt(s.totalExpenses)} | Profit ${fmt(s.netProfit)} (${s.profitMargin}%)\n**🏦 Cash:** Bank ${fmt(s.bankBalance)} | Cash ${fmt(s.cashBalance)}\n**📦 Orders:** ${s.totalOrders} total | ${s.accepted} accepted | ${s.pending} pending\n**👥 Leads:** ${s.totalLeads} total | ${s.hotLeads} warm\n**📦 Inventory:** ${s.totalProducts} products | ${s.lowStock} low alerts\n**🔮 Forecast:** Next 7 days: ${fmt(p.weeklyForecast)}\n\nAsk me about: revenue, expenses, profit, orders, leads, inventory, forecast, best products, bank balance!`;
}

router.get('/snapshot', async (req, res) => {
  try {
    const ctx = await getBusinessContext();
    res.json(ctx);
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

router.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });
  try {
    const ctx = await getBusinessContext();
    const reply = generateAnswer(message, ctx);
    res.json({ reply, context: ctx.summary });
  } catch (err) {
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});

module.exports = router;
