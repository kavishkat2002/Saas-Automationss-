# Migration Quick Reference Card

## 🎯 Your Project Details

### Old Project

- **Project ID**: `gvcotjixvlwrtiiciibs`
- **URL**: `https://gvcotjixvlwrtiiciibs.supabase.co`
- **Dashboard**: <https://supabase.com/dashboard/project/gvcotjixvlwrtiiciibs>

### New Project

- **Project ID**: `rskkufaczzltlwtpyect`
- **URL**: `https://rskkufaczzltlwtpyect.supabase.co`
- **Dashboard**: <https://supabase.com/dashboard/project/rskkufaczzltlwtpyect>

---

## 📋 Copy-Paste Commands

### 1. Get Credentials (Manual Step)

Visit these URLs and copy the service_role keys:

**Old Project API Settings:**
<https://supabase.com/dashboard/project/gvcotjixvlwrtiiciibs/settings/api>

**New Project API Settings:**
<https://supabase.com/dashboard/project/rskkufaczzltlwtpyect/settings/api>

---

### 2. Export Data

```bash
export OLD_SUPABASE_URL="https://gvcotjixvlwrtiiciibs.supabase.co"
export OLD_SUPABASE_SERVICE_KEY="YOUR_OLD_SERVICE_KEY_HERE"
export NEW_SUPABASE_URL="https://rskkufaczzltlwtpyect.supabase.co"
export NEW_SUPABASE_SERVICE_KEY="YOUR_NEW_SERVICE_KEY_HERE"

npx tsx scripts/migrate-data.ts export
```

---

### 3. Import Data

```bash
npx tsx scripts/migrate-data.ts import
```

---

### 4. Verify Migration

```bash
npx tsx scripts/migrate-data.ts verify
```

---

### 5. Update .env File

```env
VITE_SUPABASE_PROJECT_ID="rskkufaczzltlwtpyect"
VITE_SUPABASE_PUBLISHABLE_KEY="YOUR_NEW_ANON_KEY_HERE"
VITE_SUPABASE_URL="https://rskkufaczzltlwtpyect.supabase.co"
```

---

### 6. Deploy Edge Functions

```bash
supabase functions deploy telegram-webhook
supabase secrets set TELEGRAM_BOT_TOKEN=your_bot_token
supabase secrets set OPENAI_API_KEY=your_openai_key
```

---

### 7. Update Telegram Webhook

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://rskkufaczzltlwtpyect.supabase.co/functions/v1/telegram-webhook"}'
```

---

## ✅ Progress Tracker

- [x] Supabase CLI logged in
- [x] Linked to new project
- [x] Config.toml updated
- [x] Migrations pushed (schema created)
- [ ] Data exported from old project
- [ ] Data imported to new project
- [ ] Migration verified
- [ ] .env file updated
- [ ] Edge functions deployed
- [ ] Secrets configured
- [ ] Telegram webhook updated
- [ ] Application tested

---

## 🚨 Next Action

**Get your service role keys from both projects** and run the data export!

1. Visit the old project API page
2. Visit the new project API page
3. Copy both service_role keys
4. Run the export command above

---

**Full Guide**: See `MIGRATION_NEXT_STEPS.md` for detailed instructions
