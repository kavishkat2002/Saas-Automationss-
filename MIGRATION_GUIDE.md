# Supabase Migration Guide

This guide will help you migrate all data from your current Supabase project to a new one.

## 📋 Pre-Migration Checklist

- [ ] Create a new Supabase project at <https://app.supabase.com>
- [ ] Note down the new project credentials (URL, anon key, service role key)
- [ ] Ensure you have the Supabase CLI installed and authenticated
- [ ] Back up your current database

## 🔄 Migration Steps

### Step 1: Create New Supabase Project

1. Go to <https://app.supabase.com>
2. Click "New Project"
3. Choose an organization
4. Enter project name (e.g., "smartbiz-ai-connect-new")
5. Set a strong database password (save it securely!)
6. Select a region (preferably same as current project)
7. Wait for the project to initialize

### Step 2: Link to New Project

```bash
# Login to Supabase (if not already)
supabase login

# Link to your new project
supabase link --project-ref YOUR_NEW_PROJECT_REF
```

You'll find your project ref in the project settings or URL (e.g., `https://YOUR_PROJECT_REF.supabase.co`)

### Step 3: Run Migrations on New Project

The migrations will create all the tables and schema:

```bash
# Push all migrations to the new project
supabase db push
```

This will apply:

- ✅ Main schema with all tables (businesses, customers, products, orders, etc.)
- ✅ Telegram channel support
- ✅ Row Level Security policies
- ✅ Indexes and triggers
- ✅ Helper functions

### Step 4: Export Data from Old Project

#### Option A: Using Supabase Dashboard (Recommended for small datasets)

1. Go to your old project dashboard
2. Navigate to Table Editor
3. For each table, click "..." → "Export as CSV"
4. Save files for import

#### Option B: Using SQL Export (Better for large datasets)

```bash
# Set old project credentials
export OLD_PROJECT_URL="https://gvcotjixvlwrtiiciibs.supabase.co"
export OLD_SERVICE_ROLE_KEY="your_old_service_role_key"

# Export data using pg_dump (requires direct database access)
# You'll need the connection string from project settings
```

### Step 5: Import Data to New Project

#### Using Supabase Dashboard

1. Go to your new project dashboard
2. Navigate to Table Editor
3. Select each table
4. Click "Insert" → "Import from CSV"
5. Upload the corresponding CSV file

#### Using SQL Scripts

```bash
# Use the provided migration script
npm run migrate:data
```

### Step 6: Verify Data Migration

Check that all data has been migrated:

```sql
-- In the new project SQL Editor
SELECT 
  'businesses' as table_name, COUNT(*) as count FROM businesses
UNION ALL
SELECT 'customers', COUNT(*) FROM customers
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'conversations', COUNT(*) FROM conversations
UNION ALL
SELECT 'messages', COUNT(*) FROM messages;
```

### Step 7: Update Environment Variables

Update your `.env` file with new credentials:

```env
VITE_SUPABASE_PROJECT_ID="YOUR_NEW_PROJECT_ID"
VITE_SUPABASE_PUBLISHABLE_KEY="YOUR_NEW_ANON_KEY"
VITE_SUPABASE_URL="https://YOUR_NEW_PROJECT_REF.supabase.co"
```

Also update:

- `supabase/config.toml`
- Any CI/CD environment variables
- Deployment platform environment variables (if applicable)

### Step 8: Migrate Edge Functions

Deploy the Telegram webhook function:

```bash
# Deploy all functions to new project
supabase functions deploy telegram-webhook

# Set function secrets
supabase secrets set TELEGRAM_BOT_TOKEN=your_telegram_bot_token
supabase secrets set OPENAI_API_KEY=your_openai_api_key
```

### Step 9: Test the Migration

1. **Test Authentication:**

   ```bash
   npm run dev
   ```

   - Try signing up with a new account
   - Verify that business, profile, and user_role are created

2. **Test Data Access:**
   - Login and verify you can see your customers
   - Check products, orders, conversations
   - Verify Telegram bot webhook is working

3. **Test Real-time:**
   - Send a message via Telegram
   - Check if it appears in conversations/messages

### Step 10: Update Webhook URLs

If you're using webhooks (Telegram, WhatsApp):

1. **Telegram Webhook:**

   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://YOUR_NEW_PROJECT_REF.supabase.co/functions/v1/telegram-webhook"}'
   ```

2. **WhatsApp Webhook:**
   - Update in Meta Business Manager with new edge function URL

## 🔍 Troubleshooting

### Common Issues

1. **Migration fails with "relation already exists"**
   - Reset the new project database: `supabase db reset --linked`
   - Re-run migrations: `supabase db push`

2. **RLS policies blocking data import**
   - Temporarily disable RLS during import
   - Re-enable after import completes

3. **Foreign key constraint violations**
   - Import tables in the correct order:
     1. businesses
     2. profiles, user_roles
     3. customers, products
     4. orders, conversations
     5. order_items, messages
     6. analytics_logs, demand_predictions

4. **Functions not working**
   - Verify all secrets are set: `supabase secrets list`
   - Check function logs: `supabase functions logs telegram-webhook`

## 🔐 Security Notes

- ⚠️ Never commit `.env` files to Git
- ⚠️ Keep service role keys secure
- ⚠️ Use environment variables for all secrets
- ✅ Verify RLS policies are active after migration
- ✅ Test with different user roles (owner, admin, agent)

## 📊 Data Tables Migration Order

For manual import, follow this order to avoid foreign key issues:

1. `businesses`
2. `profiles` (requires auth.users - migrate users first)
3. `user_roles` (requires auth.users)
4. `customers`
5. `products`
6. `orders`
7. `conversations`
8. `order_items` (requires orders)
9. `messages` (requires conversations)
10. `analytics_logs`
11. `demand_predictions`

## 🎯 Post-Migration Checklist

- [ ] All tables have correct row counts
- [ ] User authentication works
- [ ] RLS policies are enforced
- [ ] Edge functions are deployed
- [ ] Webhooks are updated
- [ ] Real-time subscriptions work
- [ ] Environment variables updated everywhere
- [ ] Old project data backed up before deletion

## 🗑️ Decommissioning Old Project

**Only after thoroughly testing the new project:**

1. Download a final backup of the old project
2. Pause the old project (Settings → General → Pause project)
3. After 30 days of successful new project operation, delete the old project

---

## Need Help?

- Check Supabase docs: <https://supabase.com/docs>
- Supabase Discord: <https://discord.supabase.com>
- Project GitHub: File an issue
