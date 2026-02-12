# 🤖 Telegram Bot Setup Guide - 5 Minute Automation

## ✨ What This Does

When a customer messages your Telegram bot:

1. ✅ **Auto-creates customer** in your database
2. ✅ **Creates conversation** thread
3. ✅ **Logs "New lead from Telegram"** in AI Activity
4. ✅ **Shows product catalog** when asked
5. ✅ **Creates order automatically** when customer wants to buy
6. ✅ **Updates dashboard metrics** in real-time
7. ✅ **Classifies high-value customers** (Rs. 5000+)
8. ✅ **All messages saved** in conversations table

**Dashboard updates immediately!** 🔥

---

## 🚀 STEP 1: Create Your Telegram Bot (2 minutes)

### 1. Open Telegram and find **@BotFather**

Search for `@BotFather` in Telegram and start a chat.

### 2. Create a new bot

Send this command:

```
/newbot
```

### 3. Follow the prompts

BotFather will ask:

- **Bot name**: `SmartBiz AI Assistant` (or your business name)
- **Username**: `smartbiz_ai_bot` (must end in `_bot`)

### 4. Save your token! 🔑

BotFather will give you a token like:

```
6123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw
```

**SAVE THIS!** You'll need it next.

---

## 🔧 STEP 2: Deploy the Webhook (3 minutes)

### 1. Install Supabase CLI (if not installed)

```bash
# macOS
brew install supabase/tap/supabase

# Verify
supabase --version
```

### 2. Login to Supabase

```bash
supabase login
```

### 3. Link your project

```bash
cd "/Users/kavishkathilakarathna/Library/CloudStorage/OneDrive-CardiffMetropolitanUniversity/Biz automation proj/smartbiz-ai-connect"

supabase link --project-ref YOUR_PROJECT_REF
```

**Find your project ref:**

- Go to <https://supabase.com/dashboard>
- Click your project → Settings → General
- Copy "Reference ID"

### 4. Set the bot token secret

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=6123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw
```

Replace with YOUR actual token from BotFather!

### 5. Deploy the function

```bash
supabase functions deploy telegram-webhook --no-verify-jwt
```

### 6. Get your webhook URL

After deployment, you'll see:

```
Deployed Function URLs:
https://YOUR_PROJECT.supabase.co/functions/v1/telegram-webhook
```

**SAVE THIS URL!** 📋

---

## 🔗 STEP 3: Connect Telegram to Your Webhook

### Send this command in your terminal

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://YOUR_PROJECT.supabase.co/functions/v1/telegram-webhook"}'
```

**Replace:**

- `<YOUR_BOT_TOKEN>` with your token from BotFather
- `https://YOUR_PROJECT.supabase.co...` with your Supabase function URL

**Expected response:**

```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

### Verify webhook is set

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

Should show your webhook URL!

---

## ✅ STEP 4: Test Your Bot

### 1. Find your bot in Telegram

Search for `@smartbiz_ai_bot` (or whatever username you chose)

### 2. Start a conversation

Send: `/start`

**Bot responds:**

```
👋 Welcome to SmartBiz AI!

I can help you with:
📦 /catalog - View our products
🛒 /order - Place an order
💬 Just chat with me for assistance!

What would you like to do?
```

### 3. Test catalog command

Send: `/catalog`

**Bot shows all your products!**

### 4. Test auto-order creation

Send: `I want to order Premium Widget`

**Bot creates order automatically!**

```
✅ Order Created!

📦 Product: Premium Widget
💰 Total: Rs. 7,500.00
📋 Order ID: 1a2b3c4d

Our team will contact you shortly...
```

### 5. Check your dashboard! 🎉

Go to `http://localhost:8080`

**You'll see:**

- ✅ New customer created
- ✅ AI Activity: "New lead detected from Telegram"
- ✅ AI Activity: "AI closed order for Rs. 7,500"
- ✅ Revenue Today increased
- ✅ New conversation in Conversations page
- ✅ Customer in Customers page with total_spent updated

**EVERYTHING WORKS AUTOMATICALLY!** 🚀

---

## 📱 Bot Commands

Your bot understands:

| Command | What it does |
|---------|-------------|
| `/start` | Welcome message |
| `/help` | Show help menu |
| `/catalog` | Show all products |
| `/order` | Start order process |
| `I want [product]` | Auto-create order |
| `Show products` | Show catalog |
| Any other text | General AI response |

---

## 🧠 AI Intelligence

The bot automatically:

### 1. Intent Detection

- Catalog requests → Shows products
- Order requests → Creates order if product mentioned
- General chat → Helpful response

### 2. Product Matching

Customer says: "I want to buy Premium Widget"  
Bot: Searches products, finds match, creates order

### 3. Customer Classification

After order, if total_spent >= Rs. 5000:

- Logs: "Customer classified as high-value"

### 4. Activity Logging

Every action logs to `analytics_logs`:

- New lead from Telegram
- Order created
- Customer value classification

---

## 📊 What You'll See in Dashboard

### Dashboard (Business Health)

- ✅ Revenue Today: Updates when order created
- ✅ Pending Orders: Shows Telegram orders
- ✅ Total Customers: Includes Telegram customers
- ✅ AI Activity: Shows all bot actions

### AI Insights

- ✅ High Value Customers: Telegram customers who spent Rs. 5000+
- ✅ Product Demand: Shows what Telegram customers ordered
- ✅ Weekly Forecast: Includes Telegram orders

### Customers Page

- ✅ New customer with phone: `telegram:123456789`
- ✅ Name from Telegram username
- ✅ Total spent updates automatically

### Orders Page

- ✅ Order created by bot
- ✅ Linked to Telegram customer
- ✅ Status: pending

### Conversations Page

- ✅ Full chat history
- ✅ Channel: telegram
- ✅ Customer messages + Bot responses

---

## 🔍 Debugging

### Check if webhook is working

```bash
# Get recent updates
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates"
```

### View Supabase function logs

```bash
supabase functions logs telegram-webhook --limit 50
```

### Test webhook directly

```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/telegram-webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "message_id": 1,
      "from": {"id": 123, "first_name": "Test", "username": "testuser"},
      "chat": {"id": 123},
      "text": "/catalog"
    }
  }'
```

---

## 🎯 Demo Flow for First Customer

**Create this perfect demo:**

1. **Add products first** (via dashboard):
   - Premium Widget - Rs. 7,500
   - Starter Package - Rs. 2,500
   - Growth Plan - Rs. 4,999

2. **Customer messages bot on Telegram:**

   ```
   Customer: Hi
   Bot: 👋 Welcome! /catalog to see products
   
   Customer: /catalog
   Bot: [Shows 3 products with prices]
   
   Customer: I want to order Premium Widget
   Bot: ✅ Order Created! Rs. 7,500...
   ```

3. **Check dashboard:**
   - Revenue Today: Rs. 7,500 ✅
   - New customer appears ✅
   - AI Activity shows order ✅
   - AI Insights updates ✅

4. **Customer orders again:**

   ```
   Customer: I'll take the Growth Plan too
   Bot: ✅ Order Created! Rs. 4,999...
   ```

5. **Dashboard updates:**
   - Revenue: Rs. 12,499 ✅
   - Customer: High-value (spent > Rs. 5000) ✅
   - Repeat customer ✅
   - AI Activity: "Customer classified as high-value" ✅

**Perfect automation demo! 🎉**

---

## 💡 Pro Tips

### 1. Customize bot responses

Edit `/supabase/functions/telegram-webhook/index.ts`:

- Change welcome message
- Add more intents
- Customize product display

### 2. Add product images

Update catalog response to include image URLs:

```typescript
aiResponse += `   🖼 ${p.image_url}\n`;
```

### 3. Add payment links

When order created, include payment link:

```typescript
aiResponse += `\n💳 Pay here: https://your-payment-link`;
```

### 4. Human handoff

If customer says "talk to human":

```typescript
if (text.includes("human") || text.includes("agent")) {
  await supabase
    .from("conversations")
    .update({ is_human_takeover: true })
    .eq("id", conversation.id);
  
  aiResponse = "Connecting you to a human agent...";
}
```

---

## 🚀 You're Live

**You now have:**

- ✅ Working Telegram bot
- ✅ Auto customer creation
- ✅ Auto order processing
- ✅ Real-time dashboard updates
- ✅ AI activity logging
- ✅ Product catalog automation

**Next Steps:**

1. Share bot with test customers
2. Monitor dashboard for orders
3. Iterate based on real feedback
4. Add more products
5. Customize responses

**Time to get real customers! 🔥**

---

## 📞 Support

**Issues?**

1. Check Supabase function logs: `supabase functions logs telegram-webhook`
2. Verify webhook: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
3. Check database: customers, orders, analytics_logs tables

**Common Issues:**

- Bot not responding → Check webhook URL is set correctly
- Orders not creating → Check products exist and are active
- Dashboard not updating → Check business_id mapping in webhook code

---

## 🎓 What You've Built

This is a **real SaaS automation**:

```
Customer (Telegram) 
    ↓
Telegram API 
    ↓
Your Webhook (Supabase Edge Function)
    ↓
AI Intent Detection
    ↓
Auto-Create Customer/Order
    ↓
Update Database
    ↓
Dashboard Updates in Real-Time
```

**You have a working AI sales agent!** 🤖💰
