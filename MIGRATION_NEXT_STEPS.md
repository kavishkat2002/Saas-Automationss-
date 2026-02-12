# Next Steps: Data Migration

## ✅ Completed So Far

- ✅ Logged into Supabase CLI
- ✅ Linked to new project (rskkufaczzltlwtpyect)
- ✅ Updated config.toml
- ✅ Pushed migrations (all tables created!)

## 📋 Step-by-Step: Complete the Migration

### Step 1: Get Your New Project Credentials

Go to your new project dashboard and get the credentials:

**Dashboard URL:** <https://supabase.com/dashboard/project/rskkufaczzltlwtpyect>

1. Click on **Settings** (gear icon) in the sidebar
2. Go to **API** section
3. Copy these values:

   - **Project URL**: `https://rskkufaczzltlwtpyect.supabase.co`
   - **anon/public key**: Copy the `anon public` key
   - **service_role key**: Copy the `service_role` key (click "Reveal" first)

### Step 2: Get Old Project Service Key

Go to your old project:

**Old Dashboard:** <https://supabase.com/dashboard/project/gvcotjixvlwrtiiciibs>

1. Click on **Settings** → **API**
2. Copy the **service_role key** (you'll need this for data export)

### Step 3: Export Data from Old Project

Open a new terminal and run:

```bash
# Set environment variables
export OLD_SUPABASE_URL="https://gvcotjixvlwrtiiciibs.supabase.co"
export OLD_SUPABASE_SERVICE_KEY="your_old_service_role_key_here"
export NEW_SUPABASE_URL="https://rskkufaczzltlwtpyect.supabase.co"
export NEW_SUPABASE_SERVICE_KEY="your_new_service_role_key_here"

# Export all data
npx tsx scripts/migrate-data.ts export
```

This will create a `migration-exports` folder with all your data.

### Step 4: Import Data to New Project

```bash
# Same terminal, same environment variables set
npx tsx scripts/migrate-data.ts import
```

### Step 5: Verify Migration

```bash
npx tsx scripts/migrate-data.ts verify
```

This will show a comparison table of row counts between old and new projects.

### Step 6: Update Environment Variables

Update your `.env` file:

```env
VITE_SUPABASE_PROJECT_ID="rskkufaczzltlwtpyect"
VITE_SUPABASE_PUBLISHABLE_KEY="your_new_anon_key_here"
VITE_SUPABASE_URL="https://rskkufaczzltlwtpyect.supabase.co"
```

### Step 7: Deploy Edge Functions

```bash
# Deploy the Telegram webhook function
supabase functions deploy telegram-webhook

# Set your secrets
supabase secrets set TELEGRAM_BOT_TOKEN=your_telegram_bot_token
supabase secrets set OPENAI_API_KEY=your_openai_api_key
```

### Step 8: Update Telegram Webhook

Update your Telegram bot to use the new webhook URL:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://rskkufaczzltlwtpyect.supabase.co/functions/v1/telegram-webhook"}'
```

### Step 9: Test Everything

1. **Restart your dev server:**

   ```bash
   npm run dev
   ```

2. **Test the application:**
   - Sign in to the dashboard
   - Verify you can see data
   - Send a test Telegram message
   - Check if it appears in conversations

## 🔑 Quick Command Reference

### One-Command Full Migration

```bash
# After setting environment variables
npx tsx scripts/migrate-data.ts full
```

This runs export, import, and verify all in one go!

### Individual Commands

```bash
# Export only
npx tsx scripts/migrate-data.ts export

# Import only
npx tsx scripts/migrate-data.ts import

# Verify only
npx tsx scripts/migrate-data.ts verify
```

## 📊 Expected Data Tables

Your migration should include:

1. `businesses` - Your business data
2. `customers` - Customer records
3. `products` - Product catalog
4. `orders` - Order history
5. `conversations` - Chat conversations
6. `order_items` - Order line items
7. `messages` - Chat messages
8. `analytics_logs` - Analytics data
9. `demand_predictions` - AI predictions

## ⚠️ Important Notes

1. **Service Role Keys**: Make sure you're using `service_role` keys, NOT `anon` keys
2. **Keep Old Project Active**: Don't delete it until everything is tested
3. **Auth Users**: Existing users will need to sign up again (or you can migrate auth separately)
4. **Test Thoroughly**: Test all features before going live

## 🆘 Troubleshooting

### "Cannot find module '@supabase/supabase-js'"

```bash
npm install @supabase/supabase-js
```

### "Invalid API key"

- Double-check you're using the correct service_role keys
- Make sure OLD_ variables match the old project
- Make sure NEW_ variables match the new project

### "Permission denied"

- Verify service_role keys (not anon keys)
- Check that RLS is enabled (it should be)

## 📖 What's Next?

After completing these steps:

1. ✅ Check migration verification results
2. ✅ Test the application thoroughly
3. ✅ Update any deployment configs
4. ✅ Update team members with new URLs
5. ✅ Keep old project paused (don't delete yet)

---

**Need help?** Check `MIGRATION_GUIDE.md` for detailed troubleshooting!
