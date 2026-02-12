#!/bin/bash

# Supabase Migration Quick Commands
# This file contains quick reference commands for migrating to a new Supabase project

echo "╔════════════════════════════════════════════╗"
echo "║   Supabase Migration Quick Reference      ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Step 1: Link to New Project${NC}"
echo "supabase link --project-ref YOUR_NEW_PROJECT_REF"
echo ""

echo -e "${BLUE}📋 Step 2: Push Migrations${NC}"
echo "supabase db push"
echo ""

echo -e "${BLUE}📋 Step 3: Export Data (using script)${NC}"
echo "export OLD_SUPABASE_URL='https://gvcotjixvlwrtiiciibs.supabase.co'"
echo "export OLD_SUPABASE_SERVICE_KEY='your_old_service_role_key'"
echo "export NEW_SUPABASE_URL='https://YOUR_NEW_PROJECT.supabase.co'"
echo "export NEW_SUPABASE_SERVICE_KEY='your_new_service_role_key'"
echo "npx tsx scripts/migrate-data.ts export"
echo ""

echo -e "${BLUE}📋 Step 4: Import Data${NC}"
echo "npx tsx scripts/migrate-data.ts import"
echo ""

echo -e "${BLUE}📋 Step 5: Verify Migration${NC}"
echo "npx tsx scripts/migrate-data.ts verify"
echo ""

echo -e "${BLUE}📋 Step 6: Deploy Edge Functions${NC}"
echo "supabase functions deploy telegram-webhook"
echo ""

echo -e "${BLUE}📋 Step 7: Set Secrets${NC}"
echo "supabase secrets set TELEGRAM_BOT_TOKEN=your_token"
echo "supabase secrets set OPENAI_API_KEY=your_key"
echo ""

echo -e "${BLUE}📋 Step 8: Update .env${NC}"
echo "Update .env file with new credentials:"
echo "  VITE_SUPABASE_PROJECT_ID"
echo "  VITE_SUPABASE_PUBLISHABLE_KEY"
echo "  VITE_SUPABASE_URL"
echo ""

echo -e "${BLUE}📋 Step 9: Update Telegram Webhook${NC}"
echo "curl -X POST 'https://api.telegram.org/bot<TOKEN>/setWebhook' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"url\": \"https://YOUR_PROJECT.supabase.co/functions/v1/telegram-webhook\"}'"
echo ""

echo -e "${GREEN}✨ All done! Test your application thoroughly before decommissioning the old project.${NC}"
