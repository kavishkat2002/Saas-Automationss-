# Supabase Migration - Quick Start

This guide will help you quickly migrate your SmartBiz AI Connect data to a new Supabase project.

## 📁 Migration Files

I've created several files to help with your migration:

1. **`MIGRATION_GUIDE.md`** - Detailed step-by-step migration guide
2. **`MIGRATION_CHECKLIST.md`** - Interactive checklist to track progress
3. **`scripts/migrate-data.ts`** - Automated data export/import script
4. **`scripts/migration-commands.sh`** - Quick reference for all commands
5. **`.env.migration.example`** - Template for migration credentials

## 🚀 Quick Start (5 Steps)

### 1️⃣ Create New Supabase Project

Go to <https://app.supabase.com> and create a new project. Save these credentials:

- Project URL
- Anon/Public Key
- Service Role Key
- Database Password

### 2️⃣ Link and Push Schema

```bash
# Link to your new project
supabase link --project-ref YOUR_NEW_PROJECT_REF

# Push all migrations (creates all tables, RLS policies, etc.)
supabase db push
```

### 3️⃣ Export Data from Old Project

```bash
# Set credentials
export OLD_SUPABASE_URL="https://gvcotjixvlwrtiiciibs.supabase.co"
export OLD_SUPABASE_SERVICE_KEY="your_old_service_role_key"
export NEW_SUPABASE_URL="https://YOUR_NEW_PROJECT.supabase.co"
export NEW_SUPABASE_SERVICE_KEY="your_new_service_role_key"

# Export all data
npx tsx scripts/migrate-data.ts export
```

### 4️⃣ Import Data to New Project

```bash
# Import all data
npx tsx scripts/migrate-data.ts import

# Verify the migration
npx tsx scripts/migrate-data.ts verify
```

### 5️⃣ Update Configuration

```bash
# Update .env file with new credentials
# Update supabase/config.toml

# Deploy edge functions
supabase functions deploy telegram-webhook

# Set secrets
supabase secrets set TELEGRAM_BOT_TOKEN=your_token
supabase secrets set OPENAI_API_KEY=your_key

# Update Telegram webhook
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://YOUR_NEW_PROJECT.supabase.co/functions/v1/telegram-webhook"}'
```

## 📊 What Gets Migrated

Your migration includes:

### Database Schema

- ✅ 11 tables (businesses, customers, products, orders, etc.)
- ✅ Row Level Security (RLS) policies
- ✅ Database triggers
- ✅ Helper functions
- ✅ Indexes for performance

### Data Tables (in migration order)

1. `businesses` - Your business information
2. `customers` - Customer/CRM data
3. `products` - Product catalog
4. `orders` - Order history
5. `conversations` - Telegram/WhatsApp conversations
6. `order_items` - Order line items
7. `messages` - Conversation messages
8. `analytics_logs` - Analytics events
9. `demand_predictions` - AI predictions

### Edge Functions

- `telegram-webhook` - Handles Telegram bot messages

## ⚠️ Important Notes

1. **Service Role Keys**: You need service role keys (not anon keys) for data migration
   - Find them in: Project Settings → API → service_role key

2. **Auth Users**: Regular users are managed by Supabase Auth and may need to be migrated separately if you have existing users

3. **Storage**: If you're using Supabase Storage for files, those need separate migration

4. **Testing**: Test thoroughly before updating production environment variables

5. **Rollback**: Keep old project active until you're 100% confident

## 🔍 Troubleshooting

### "Cannot find module '@supabase/supabase-js'"

```bash
npm install @supabase/supabase-js
```

### "Error: Invalid API key"

- Double-check you're using service_role keys, not anon keys
- Verify the keys match the correct projects (old vs new)

### "Foreign key constraint violation"

- The script imports tables in the correct order
- If manually importing, follow the order in the migration guide

### "Migration command not found"

```bash
# Install Supabase CLI
npm install -g supabase
# Or use Homebrew
brew install supabase/tap/supabase
```

## 📚 Additional Resources

- **Full Guide**: See `MIGRATION_GUIDE.md` for detailed instructions
- **Checklist**: Use `MIGRATION_CHECKLIST.md` to track progress
- **Commands**: View `scripts/migration-commands.sh` for quick reference

## 🆘 Need Help?

If you encounter issues:

1. Check the detailed guide in `MIGRATION_GUIDE.md`
2. Review Supabase docs: <https://supabase.com/docs>
3. Check function logs: `supabase functions logs telegram-webhook`
4. Verify in database: Use the SQL Editor in Supabase dashboard

---

**Ready to start?** Open `MIGRATION_CHECKLIST.md` and begin checking off items! 🚀
