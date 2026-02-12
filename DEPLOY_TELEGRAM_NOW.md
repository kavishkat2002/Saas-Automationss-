# 🚀 Deploy Telegram Bot - Alternative Method (No Supabase CLI Needed!)

Your Token: `8404455952:AAGEmfYqHVUYnCwT3sL-Lgz_q36QwuBdGG0`

## Method 1: Using Supabase Dashboard (Easiest)

### Step 1: Deploy Function via Dashboard

1. **Go to Supabase Dashboard:**
   - Visit: <https://supabase.com/dashboard>
   - Select your project: `smartbiz-ai-connect`

2. **Navigate to Edge Functions:**
   - Left sidebar → **Edge Functions**
   - Click **"Create a new function"**

3. **Create the function:**
   - Name: `telegram-webhook`
   - Click **Create function**

4. **Copy the code:**
   - Open: `/supabase/functions/telegram-webhook/index.ts` (the file I created)
   - Copy ALL the code
   - Paste into the function editor in Supabase dashboard
   - Click **Deploy**

5. **Add Environment Variable:**
   - In the function settings → **Secrets**
   - Add new secret:
     - Name: `TELEGRAM_BOT_TOKEN`
     - Value: `8404455952:AAGEmfYqHVUYnCwT3sL-Lgz_q36QwuBdGG0`
   - Save

6. **Get your webhook URL:**
   - After deployment, you'll see:
   - `https://YOUR_PROJECT_REF.supabase.co/functions/v1/telegram-webhook`
   - **SAVE THIS URL!**

### Step 2: Connect Telegram to Webhook

Open Terminal and run:

```bash
curl -X POST "https://api.telegram.org/bot8404455952:AAGEmfYqHVUYnCwT3sL-Lgz_q36QwuBdGG0/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://YOUR_PROJECT_REF.supabase.co/functions/v1/telegram-webhook"}'
```

**Replace `YOUR_PROJECT_REF`** with your actual project reference ID!

**Expected response:**

```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

### Step 3: Test Your Bot

1. Open Telegram
2. Search for your bot (the username you created)
3. Send: `/start`
4. Bot should respond!
5. Try: `/catalog`
6. Try: `I want to order [product name]`
7. Check dashboard at <http://localhost:8080>

---

## Method 2: Using Supabase CLI (Once Installed)

Once the CLI installation completes, run:

```bash
# Login
supabase login

# Link project
supabase link --project-ref YOUR_PROJECT_REF

# Set secret
supabase secrets set TELEGRAM_BOT_TOKEN="8404455952:AAGEmfYqHVUYnCwT3sL-Lgz_q36QwuBdGG0"

# Deploy
supabase functions deploy telegram-webhook --no-verify-jwt

# Set webhook
curl -X POST "https://api.telegram.org/bot8404455952:AAGEmfYqHVUYnCwT3sL-Lgz_q36QwuBdGG0/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://YOUR_PROJECT_REF.supabase.co/functions/v1/telegram-webhook"}'
```

---

## Find Your Project Reference ID

1. Go to: <https://supabase.com/dashboard>
2. Select your project
3. Click **Settings** (left sidebar)
4. Click **General**
5. Copy **Reference ID** (looks like: `abcdefghijklmnop`)

---

## Verify Webhook is Working

```bash
# Check webhook status
curl "https://api.telegram.org/bot8404455952:AAGEmfYqHVUYnCwT3sL-Lgz_q36QwuBdGG0/getWebhookInfo"
```

Should show your Supabase URL!

---

## Quick Test Commands

**Get bot info:**

```bash
curl "https://api.telegram.org/bot8404455952:AAGEmfYqHVUYnCwT3sL-Lgz_q36QwuBdGG0/getMe"
```

**Test webhook manually:**

```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/telegram-webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "message_id": 1,
      "from": {"id": 123, "first_name": "Test", "username": "test"},
      "chat": {"id": 123},
      "text": "/catalog"
    }
  }'
```

---

## 🎯 What Happens Next

Once webhook is set:

1. **Customer messages bot** → Webhook triggers
2. **Webhook creates customer** → Saved to database
3. **AI detects intent** → catalog/order/help
4. **Bot responds** → Shows products or creates order
5. **Dashboard updates** → Real-time!

**You're live!** 🚀
