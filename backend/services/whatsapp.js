const axios = require('axios');
const db = require('../db');

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || 'YOUR_META_API_TOKEN';
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || 'YOUR_PHONE_NUMBER_ID';
const WA_API_URL = `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`;

// Send a plain text message via WhatsApp
async function sendWhatsAppMessage(to, text, leadId = null) {
  try {
    if (leadId) {
      await db.query('INSERT INTO messages (lead_id, sender, content) VALUES ($1, $2, $3)', [leadId, 'bot', text]);
    }
    await axios.post(
      WA_API_URL,
      { messaging_product: 'whatsapp', to, text: { body: text } },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('WhatsApp send error:', error.response?.data || error.message);
  }
}

// Main handler
async function handleIncomingMessage(phone, text) {
  // Recover or create lead
  let leadResult = await db.query('SELECT * FROM leads WHERE phone = $1', [phone]);
  let lead = leadResult.rows[0];
  if (!lead) {
    const insertRes = await db.query(
      'INSERT INTO leads (phone, name, status, current_step, chat_metadata) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [phone, 'WhatsApp User', 'New', 'START', '{}']
    );
    lead = insertRes.rows[0];
  }

  // Log incoming message
  await db.query('INSERT INTO messages (lead_id, sender, content) VALUES ($1,$2,$3)', [lead.id, 'customer', text]);

  let step = lead.current_step || 'START';
  let metadata = lead.chat_metadata || {};
  let outMsg = '';

  const inputLower = text.toLowerCase().trim();

  // Reset triggers
  if (['reset', 'hi', 'hello', 'start', 'menu'].includes(inputLower)) {
    step = 'START';
    metadata = {};
  }

  switch (step) {
    // ─── WELCOME ─────────────────────────────────────────────────────────────
    case 'START':
      outMsg = `👋 Welcome to our Business Store!\n\nI'm your AI Shopping Assistant. What would you like to do?\n\n1️⃣ Browse & Order Products\n2️⃣ Track My Order\n3️⃣ Talk to a Specialist\n\nReply with 1, 2, or 3`;
      step = 'INTENT_DISCOVERY';
      break;

    // ─── INTENT ──────────────────────────────────────────────────────────────
    case 'INTENT_DISCOVERY':
      if (text === '1') {
        outMsg = `🛍️ Great! Let's get you set up.\n\nWhat is your *full name*?`;
        step = 'COLLECT_NAME';
        metadata.intent = 'BUY';
      } else if (text === '2') {
        outMsg = `🔍 Please share the *phone number* you used to place the order, or say "my orders" to see your orders.`;
        step = 'COMPLETED';
      } else if (text === '3') {
        outMsg = `📞 One of our specialists will follow up shortly!\n\nFirst, what is your *full name*?`;
        step = 'COLLECT_NAME';
        metadata.intent = 'SUPPORT';
      } else {
        outMsg = `Please reply with *1*, *2*, or *3* to continue.`;
      }
      break;

    // ─── COLLECT NAME ────────────────────────────────────────────────────────
    case 'COLLECT_NAME':
      metadata.name = text;
      await db.query('UPDATE leads SET name = $1 WHERE id = $2', [text, lead.id]);
      if (metadata.intent === 'BUY') {
        outMsg = `Nice to meet you, *${text}*! 😊\n\nWhat type/category of product are you looking for?\n(e.g. Electronics, Clothing, Furniture, Food items)`;
        step = 'COLLECT_PRODUCT_TYPE';
      } else {
        outMsg = `Thank you, *${text}*! How can we help you today? Please describe your query.`;
        step = 'COLLECT_SUPPORT_QUERY';
      }
      break;

    // ─── COLLECT PRODUCT TYPE ────────────────────────────────────────────────
    case 'COLLECT_PRODUCT_TYPE':
      metadata.productType = text;
      outMsg = `Got it! 📦 What is your *budget range*?\n(e.g. 5000-15000 or "under 10000")`;
      step = 'COLLECT_BUDGET';
      break;

    // ─── COLLECT BUDGET → SEARCH INVENTORY ──────────────────────────────────
    case 'COLLECT_BUDGET':
      metadata.budget = text;
      try {
        const maxBudget = parseInt(text.replace(/[^0-9]/g, ''), 10) || 999999999;
        const { rows: matches } = await db.query(
          'SELECT id, brand, price, category, stock FROM products WHERE (category ILIKE $1 OR brand ILIKE $1) AND price <= $2 AND stock > 0 LIMIT 5',
          [`%${metadata.productType}%`, maxBudget]
        );

        if (matches.length > 0) {
          metadata.searchResults = matches;
          let productList = matches.map((m, i) =>
            `${i + 1}️⃣ *${m.brand}* — Rs. ${Number(m.price).toLocaleString()}\n   Category: ${m.category} | In Stock: ${m.stock}`
          ).join('\n\n');
          outMsg = `✅ Here are products matching your request:\n\n${productList}\n\n━━━━━━━━━━━━━━━━━\nReply with the *number* to select a product, or type *0* to see all products.`;
          step = 'PRODUCT_SELECTION';
        } else {
          outMsg = `😔 No products found in that category/budget right now.\n\nOur sales team will follow up with you shortly!\n\nType *menu* to start over.`;
          step = 'COMPLETED';
          await db.query('UPDATE leads SET interested_product = $1, budget = $2, status = $3 WHERE id = $4', [metadata.productType, metadata.budget, 'Warm', lead.id]);
        }
      } catch (err) {
        console.error('Inventory search error:', err);
        outMsg = 'Our team will follow up shortly with personalised options! 📦';
        step = 'COMPLETED';
      }
      break;

    // ─── PRODUCT SELECTION ───────────────────────────────────────────────────
    case 'PRODUCT_SELECTION': {
      const idx = parseInt(text, 10) - 1;
      const results = metadata.searchResults || [];

      if (text === '0') {
        // Show all products
        const { rows: all } = await db.query('SELECT id, brand, price, category, stock FROM products WHERE stock > 0 LIMIT 10');
        metadata.searchResults = all;
        let allList = all.map((m, i) =>
          `${i + 1}️⃣ *${m.brand}* — Rs. ${Number(m.price).toLocaleString()} | Stock: ${m.stock}`
        ).join('\n');
        outMsg = `📦 *All Available Products:*\n\n${allList}\n\nReply with the number to select.`;
      } else if (idx >= 0 && idx < results.length) {
        const selected = results[idx];
        metadata.selectedProduct = selected;
        outMsg = `🛍️ You selected:\n*${selected.brand}*\nPrice: *Rs. ${Number(selected.price).toLocaleString()}*\nCategory: ${selected.category}\n\n━━━━━━━━━━━━━━━━━\nHow many do you want to order?\n(Reply with quantity, e.g. *1*, *2*)`;
        step = 'COLLECT_QUANTITY';
      } else {
        outMsg = `Please reply with a valid number from the list above, or *0* to see all products.`;
      }
      break;
    }

    // ─── COLLECT QUANTITY ────────────────────────────────────────────────────
    case 'COLLECT_QUANTITY': {
      const qty = parseInt(text, 10);
      if (isNaN(qty) || qty < 1) {
        outMsg = `Please enter a valid quantity (e.g. *1*, *2*, *3*)`;
      } else {
        const prod = metadata.selectedProduct;
        if (qty > prod.stock) {
          outMsg = `⚠️ Sorry, only *${prod.stock}* units are available. Please enter a quantity ≤ ${prod.stock}.`;
        } else {
          metadata.quantity = qty;
          const total = (Number(prod.price) * qty).toLocaleString();
          outMsg = `📋 *Order Summary:*\n━━━━━━━━━━━━━━━━━\n🛍️ Product: *${prod.brand}*\n💰 Unit Price: Rs. ${Number(prod.price).toLocaleString()}\n🔢 Quantity: *${qty}*\n💵 *Total: Rs. ${total}*\n━━━━━━━━━━━━━━━━━\n\nHow would you like to pay?\n1️⃣ Cash on Delivery\n2️⃣ Bank Transfer\n3️⃣ Card Payment`;
          step = 'COLLECT_PAYMENT_METHOD';
        }
      }
      break;
    }

    // ─── COLLECT PAYMENT METHOD ──────────────────────────────────────────────
    case 'COLLECT_PAYMENT_METHOD': {
      const payMap = { '1': 'Cash on Delivery', '2': 'Bank Transfer', '3': 'Card Payment' };
      const payMethod = payMap[text];
      if (!payMethod) {
        outMsg = `Please reply with *1*, *2*, or *3* to select payment method.`;
      } else {
        metadata.paymentMethod = payMethod;
        const prod = metadata.selectedProduct;
        const total = (Number(prod.price) * metadata.quantity).toLocaleString();
        outMsg = `📦 *Confirm Your Order:*\n━━━━━━━━━━━━━━━━━\n👤 Name: *${metadata.name}*\n🛍️ Product: *${prod.brand}*\n🔢 Qty: ${metadata.quantity}\n💵 Total: *Rs. ${total}*\n💳 Payment: ${payMethod}\n━━━━━━━━━━━━━━━━━\n\nReply *YES* to confirm or *NO* to cancel.`;
        step = 'CONFIRM_ORDER';
      }
      break;
    }

    // ─── CONFIRM ORDER ───────────────────────────────────────────────────────
    case 'CONFIRM_ORDER': {
      if (inputLower === 'yes' || inputLower === 'confirm') {
        const prod = metadata.selectedProduct;
        const totalAmount = Number(prod.price) * metadata.quantity;

        // Update lead info
        await db.query(
          'UPDATE leads SET name = $1, interested_product = $2, budget = $3, status = $4 WHERE id = $5',
          [metadata.name, prod.brand, prod.price.toString(), 'Warm', lead.id]
        );

        // Create order record
        try {
          const orderRes = await db.query(`
            INSERT INTO orders (lead_id, customer_name, customer_phone, product_id, product_name, product_price, quantity, total_amount, payment_method, notes, receipt_data)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id
          `, [
            lead.id, metadata.name, phone,
            prod.id, prod.brand, prod.price,
            metadata.quantity, totalAmount,
            metadata.paymentMethod,
            `WhatsApp order via bot`,
            JSON.stringify({ orderedAt: new Date().toISOString(), product: prod, quantity: metadata.quantity, paymentMethod: metadata.paymentMethod })
          ]);

          const orderId = orderRes.rows[0].id;
          const orderTime = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

          outMsg = `✅ *Order Confirmed!*\n━━━━━━━━━━━━━━━━━\n📋 Order #${orderId}\n📅 ${orderTime}\n\n👤 Customer: ${metadata.name}\n🛍️ ${prod.brand} x${metadata.quantity}\n💵 Total: Rs. ${totalAmount.toLocaleString()}\n💳 Payment: ${metadata.paymentMethod}\n━━━━━━━━━━━━━━━━━\n\n🔔 Our team will review your order and confirm delivery shortly.\n\nThank you for shopping with us! 🎉`;

          step = 'ORDER_PLACED';
          metadata.orderId = orderId;
        } catch (err) {
          console.error('Order creation error:', err);
          outMsg = `⚠️ There was an issue placing your order. Please try again or contact us directly.`;
        }
      } else if (inputLower === 'no' || inputLower === 'cancel') {
        outMsg = `❌ Order cancelled. Type *menu* to start again or browse other products.`;
        step = 'COMPLETED';
        metadata = {};
      } else {
        outMsg = `Please reply *YES* to confirm or *NO* to cancel your order.`;
      }
      break;
    }

    // ─── ORDER PLACED ────────────────────────────────────────────────────────
    case 'ORDER_PLACED':
      outMsg = `Your order #${metadata.orderId} is being processed. 🔄\n\nOur team will contact you for delivery confirmation.\n\nType *menu* to place another order or browse more products.`;
      break;

    // ─── SUPPORT ─────────────────────────────────────────────────────────────
    case 'COLLECT_SUPPORT_QUERY':
      metadata.query = text;
      outMsg = `✅ Thank you for reaching out! A specialist will contact you shortly.\n\nReference: Lead #${lead.id}`;
      step = 'COMPLETED';
      break;

    case 'COMPLETED':
      outMsg = `We have your details on file! 📋\n\nType *menu* to start a new conversation or place another order.`;
      break;

    default:
      outMsg = `Thanks for your message. Our team will be with you shortly.\n\nType *menu* to start over.`;
  }

  await db.query('UPDATE leads SET current_step = $1, chat_metadata = $2 WHERE id = $3', [step, JSON.stringify(metadata), lead.id]);
  await sendWhatsAppMessage(phone, outMsg, lead.id);
}

module.exports = { handleIncomingMessage, sendWhatsAppMessage };
