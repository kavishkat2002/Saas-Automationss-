# 🚀 Quick Start - Telegram Bot in 5 Minutes

## Step 1: Create Bot (2 min)

```
1. Open Telegram → Search @BotFather
2. Send: /newbot
3. Name: SmartBiz AI Assistant
4. Username: smartbiz_ai_bot
5. SAVE TOKEN: 6123456789:AAHdq...
```

## Step 2: Deploy (1 min)

```bash
cd ~/Library/CloudStorage/OneDrive-CardiffMetropolitanUniversity/Biz\ automation\ proj/smartbiz-ai-connect

# Set token
supabase secrets set TELEGRAM_BOT_TOKEN=YOUR_TOKEN_HERE

# Deploy
supabase functions deploy telegram-webhook --no-verify-jwt
```

## Step 3: Connect (1 min)

```bash
# Replace YOUR_TOKEN and YOUR_PROJECT_URL
curl -X POST "https://api.telegram.org/botYOUR_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://YOUR_PROJECT.supabase.co/functions/v1/telegram-webhook"}'
```

## Step 4: Test! (1 min)

```
1. Find your bot in Telegram
2. Send: /start
3. Send: /catalog
4. Send: I want to order [product name]
5. Check http://localhost:8080 - see order!
```

## ✅ What Works Now

**Customer actions → Automatic results:**

| Customer sends | Bot does | Dashboard shows |
|---------------|----------|-----------------|
| Any message | Creates customer | New customer + "Lead from Telegram" |
| `/catalog` | Shows products | - |
| `I want [product]` | Creates order | Revenue ↑, AI Activity log |
| Orders Rs. 5000+ | - | "High-value customer" |

## 🎯 Perfect Demo

1. Add product: "Premium Widget, Rs. 7500"
2. Message bot: "I want Premium Widget"
3. See dashboard update in real-time!

## 📋 Commands Reference

```bash
# View logs
supabase functions logs telegram-webhook

# Check webhook
curl "https://api.telegram.org/botYOUR_TOKEN/getWebhookInfo"

# Test locally
supabase functions serve telegram-webhook
```

## 🐛 Troubleshooting

**Bot not responding?**

```bash
# Check webhook status
curl "https://api.telegram.org/botYOUR_TOKEN/getWebhookInfo"

# Should show your Supabase URL
```

**Orders not creating?**

- Ensure products exist and are active
- Check product name matches text
- View logs: `supabase functions logs telegram-webhook`

## 🔥 You're Live

**Full automation working:**

- ✅ Telegram → Customer created
- ✅ Message → Conversation saved
- ✅ Order request → Order created
- ✅ Dashboard → Updates real-time
- ✅ AI Activity → Logged

**Time to demo to real customers!** 🚀
