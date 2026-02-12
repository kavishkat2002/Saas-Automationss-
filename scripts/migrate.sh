#!/bin/bash

# Interactive Migration Script
# This script will guide you through the data migration process

echo "╔════════════════════════════════════════════╗"
echo "║   SmartBiz AI Connect - Data Migration    ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 This script will help you migrate data from:"
echo "   Old Project: gvcotjixvlwrtiiciibs"
echo "   New Project: rskkufaczzltlwtpyect"
echo -e "${NC}"

# Check if environment variables are set
if [ -z "$OLD_SUPABASE_SERVICE_KEY" ] || [ -z "$NEW_SUPABASE_SERVICE_KEY" ]; then
    echo -e "${YELLOW}⚠️  Service keys not found in environment${NC}"
    echo ""
    echo "Please set the following environment variables:"
    echo ""
    echo -e "${BLUE}export OLD_SUPABASE_URL='https://gvcotjixvlwrtiiciibs.supabase.co'${NC}"
    echo -e "${BLUE}export OLD_SUPABASE_SERVICE_KEY='your_old_service_key_here'${NC}"
    echo -e "${BLUE}export NEW_SUPABASE_URL='https://rskkufaczzltlwtpyect.supabase.co'${NC}"
    echo -e "${BLUE}export NEW_SUPABASE_SERVICE_KEY='your_new_service_key_here'${NC}"
    echo ""
    echo "Then run this script again!"
    echo ""
    echo "To get your service keys:"
    echo -e "${GREEN}Old project:${NC} https://supabase.com/dashboard/project/gvcotjixvlwrtiiciibs/settings/api"
    echo -e "${GREEN}New project:${NC} https://supabase.com/dashboard/project/rskkufaczzltlwtpyect/settings/api"
    exit 1
fi

echo -e "${GREEN}✅ Environment variables detected!${NC}"
echo ""

# Show what will be done
echo -e "${BLUE}This script will:${NC}"
echo "  1. Export data from old project"
echo "  2. Import data to new project"
echo "  3. Verify the migration"
echo ""

read -p "Do you want to continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo -e "${BLUE}🚀 Starting migration...${NC}"
echo ""

# Export
echo -e "${YELLOW}Step 1/3: Exporting data from old project...${NC}"
npx tsx scripts/migrate-data.ts export

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Export failed! Please check the error above.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Export completed!${NC}"
echo ""

# Import
echo -e "${YELLOW}Step 2/3: Importing data to new project...${NC}"
npx tsx scripts/migrate-data.ts import

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Import failed! Please check the error above.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Import completed!${NC}"
echo ""

# Verify
echo -e "${YELLOW}Step 3/3: Verifying migration...${NC}"
npx tsx scripts/migrate-data.ts verify

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✨ Migration Complete! ✨               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Update .env file with new credentials"
echo "  2. Deploy edge functions: supabase functions deploy telegram-webhook"
echo "  3. Set secrets and update webhooks"
echo ""
echo "See MIGRATION_NEXT_STEPS.md for detailed instructions!"
