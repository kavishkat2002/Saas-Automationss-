# 📱 WhatsApp Business API Setup Guide

## ✅ What's Already Done

1. ✅ **WhatsApp API Token** - Stored as Supabase secret
2. ✅ **WhatsApp Webhook Function** - Deployed and ready
3. ✅ **Database Schema** - Already supports WhatsApp channel

---

## 🔧 Setup Steps

### Step 1: Get Your Phone Number ID

You need to get your WhatsApp Phone Number ID from Meta:

1. Go to **Meta Business Suite**: <https://business.facebook.com>
2. Navigate to **WhatsApp** → **API Setup**
3. Find your **Phone Number ID** (looks like: `123456789012345`)
4. Copy this number - you'll need it!

### Step 2: Set Phone Number ID as Secret

```bash
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
```

### Step 3: Configure Webhook in Meta

1. Go to **Meta for Developers**: <https://developers.facebook.com>
2. Select your app
3. Go to **WhatsApp** → **Configuration**
4. Click **Edit** next to Webhook
5. Enter these values:
   - **Callback URL**: `https://rskkufaczzltlwtpyect.supabase.co/functions/v1/whatsapp-webhook`
   - **Verify Token**: `smartbiz_verify_token`
6. Click **Verify and Save**
7. Subscribe to these fields:
   - ✅ messages
   - ✅ messaging_postbacks
   - ✅ message_deliveries
   - ✅ message_reads

### Step 4: Test Your WhatsApp Bot

1. Send a test message to your WhatsApp Business number
2. Try: `catalog` - Should show your products
3. Try: `White Sugar` - Should suggest the product
4. Reply: `Yes` - Should create order!

---

## 📊 Your WhatsApp Integration Details

### Webhook URL

```
https://rskkufaczzltlwtpyect.supabase.co/functions/v1/whatsapp-webhook
```

### Verify Token

```
smartbiz_verify_token
```

### API Token Status

✅ Stored securely in Supabase secrets

---

## 🤖 Bot Capabilities (WhatsApp)

Your WhatsApp bot has the SAME smart features as Telegram:

### Supported Commands

- `catalog` - View all products
- `help` - Show help message
- `hi` / `hello` - Get started

### Smart Ordering

1. **Browse then order:**
   - Customer: `White Sugar`
   - Bot: Shows product details & asks for confirmation
   - Customer: `Yes` or `Add to cart`
   - Bot: Creates order!

2. **Direct order:**
   - Customer: `I want Flour`
   - Bot: Creates order immediately!

3. **Product catalog:**
   - Customer: `catalog`
   - Bot: Shows all products
   - Customer: Can pick any product by name

---

## 🔐 Required Meta App Permissions

Make sure your Meta app has these permissions:

- ✅ `whatsapp_business_messaging`
- ✅ `whatsapp_business_management`

To request these:

1. Go to your app in Meta for Developers
2. **App Review** → **Permissions and Features**
3. Request the permissions above

---

## 📱 Webhook Events Handled

Your webhook processes these WhatsApp events:

- ✅ **Incoming messages** - Customer texts
- ✅ **Text messages** - Product inquiries, orders
- ✅ **Order confirmations** - Yes/Buy/Add to cart

---

## 🧪 Testing Checklist

- [ ] Phone Number ID set as secret
- [ ] Webhook verified in Meta
- [ ] Subscription fields enabled
- [ ] Test message sent
- [ ] Response received
- [ ] Product catalog works
- [ ] Order creation works
- [ ] Dashboard shows WhatsApp orders

---

## 🚀 What Happens When Customer Messages

```
Customer sends WhatsApp → 
Meta forwards to webhook → 
Supabase Function processes → 
Detects intent & products → 
Creates orders automatically → 
Sends response via WhatsApp → 
Updates dashboard in real-time
```

---

## 💡 Quick Reference Commands

### View Secrets

```bash
supabase secrets list
```

### Update WhatsApp Token

```bash
supabase secrets set WHATSAPP_API_TOKEN=your_new_token
```

### Set Phone Number ID

```bash
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=your_phone_id
```

### View Function Logs

Check the Supabase dashboard:
<https://supabase.com/dashboard/project/rskkufaczzltlwtpyect/functions>

---

## ⚠️ Important Notes

1. **WhatsApp Business Account** - You need an approved WhatsApp Business account
2. **Phone Number** - Must be a business phone number registered with Meta
3. **API Access** - Make sure your Meta app has API access enabled
4. **Rate Limits** - WhatsApp has rate limits for sending messages

---

## 🎯 Next Steps

1. Get your Phone Number ID from Meta
2. Set it as a secret: `supabase secrets set WHATSAPP_PHONE_NUMBER_ID=...`
3. Configure webhook in Meta Developer Console
4. Verify webhook
5. Send test message to your WhatsApp Business number
6. Check dashboard for results!

---

## 🆘 Troubleshooting

### Webhook Not Verified

- Double-check callback URL
- Verify token must be exactly: `smartbiz_verify_token`
- Make sure function is deployed

### Messages Not Receiving

- Check Meta app has correct permissions
- Verify webhook subscriptions are enabled
- Check Supabase function logs

### Bot Not Responding

- Verify WHATSAPP_API_TOKEN is set correctly
- Check WHATSAPP_PHONE_NUMBER_ID is set
- View function logs for errors

---

**Your WhatsApp bot is ready! Just need to configure it in Meta and get your Phone Number ID!** 🚀
