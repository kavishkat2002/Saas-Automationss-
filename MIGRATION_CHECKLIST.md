# Migration Checklist

Use this checklist to track your migration progress.

## Pre-Migration

- [ ] **New Project Created**
  - Project name: _______________
  - Project ID: _______________
  - Region: _______________
  - Database password saved securely

- [ ] **Credentials Collected**
  - [ ] New project URL
  - [ ] New anon/public key
  - [ ] New service role key
  - [ ] Old service role key (if not already have)

- [ ] **Backup Created**
  - [ ] Database backup downloaded
  - [ ] Environment variables documented
  - [ ] Edge functions code backed up

## Migration Process

### Database Schema

- [ ] **Linked to new project**

  ```bash
  supabase link --project-ref _______________
  ```

- [ ] **Migrations pushed**

  ```bash
  supabase db push
  ```

  - [ ] All tables created
  - [ ] RLS policies enabled
  - [ ] Triggers created
  - [ ] Functions created

### Data Migration

- [ ] **Environment variables set**
  - [ ] OLD_SUPABASE_URL
  - [ ] OLD_SUPABASE_SERVICE_KEY
  - [ ] NEW_SUPABASE_URL
  - [ ] NEW_SUPABASE_SERVICE_KEY

- [ ] **Data exported**

  ```bash
  npx tsx scripts/migrate-data.ts export
  ```

  - [ ] businesses
  - [ ] customers
  - [ ] products
  - [ ] orders
  - [ ] conversations
  - [ ] order_items
  - [ ] messages
  - [ ] analytics_logs
  - [ ] demand_predictions

- [ ] **Data imported**

  ```bash
  npx tsx scripts/migrate-data.ts import
  ```

  - [ ] All tables imported
  - [ ] No errors in import logs

- [ ] **Migration verified**

  ```bash
  npx tsx scripts/migrate-data.ts verify
  ```

  - [ ] Row counts match
  - [ ] Sample data checked manually

### Edge Functions

- [ ] **Functions deployed**

  ```bash
  supabase functions deploy telegram-webhook
  ```

- [ ] **Secrets set**
  - [ ] TELEGRAM_BOT_TOKEN
  - [ ] OPENAI_API_KEY
  - [ ] Any other secrets

- [ ] **Function logs checked**

  ```bash
  supabase functions logs telegram-webhook
  ```

### Application Configuration

- [ ] **Environment variables updated**
  - [ ] `.env` file
  - [ ] `supabase/config.toml`
  - [ ] Deployment platform (Vercel/Netlify/etc.)
  - [ ] Any CI/CD pipelines

- [ ] **Webhooks updated**
  - [ ] Telegram webhook URL
  - [ ] WhatsApp webhook URL (if applicable)
  - [ ] Any other webhooks

## Testing

### Authentication

- [ ] **Sign up works**
  - [ ] New user created in auth.users
  - [ ] Business auto-created
  - [ ] Profile created
  - [ ] Owner role assigned

- [ ] **Sign in works**
  - [ ] Existing users can log in
  - [ ] Session persists

- [ ] **Password reset works**

### Data Access

- [ ] **Dashboard loads**
- [ ] **Customers visible**
- [ ] **Products visible**
- [ ] **Orders visible**
- [ ] **Conversations visible**

### CRUD Operations

- [ ] **Create customer**
- [ ] **Update customer**
- [ ] **Delete customer** (as owner)
- [ ] **Create product**
- [ ] **Create order**

### Real-time Features

- [ ] **Telegram bot receives messages**
- [ ] **Messages appear in dashboard**
- [ ] **Real-time updates work**

### Permissions (RLS)

- [ ] **Owner can access all features**
- [ ] **Admin can access admin features**
- [ ] **Agent has limited access**
- [ ] **Users can't see other businesses' data**

## Post-Migration

- [ ] **Application fully tested**
  - All features working
  - No console errors
  - Performance acceptable

- [ ] **Monitoring set up**
  - [ ] Error tracking configured
  - [ ] Usage monitoring active

- [ ] **Team notified**
  - [ ] New URLs shared
  - [ ] Documentation updated

- [ ] **Old project status**
  - [ ] Marked as deprecated
  - [ ] Date to delete: _______________
  - [ ] Final backup created

## Rollback Plan (if needed)

If something goes wrong:

1. [ ] Restore old `.env` values
2. [ ] Revert `supabase/config.toml`
3. [ ] Update webhooks back to old URLs
4. [ ] Deploy to production
5. [ ] Investigate issues
6. [ ] Fix and retry migration

## Notes

Use this space for any migration-specific notes:

```
Date started: _______________
Date completed: _______________
Issues encountered:


Resolutions:


```

---

**Migration Status:** [ ] In Progress | [ ] Complete | [ ] Rolled Back
