/**
 * Data Migration Script for Supabase Project Migration
 * 
 * This script helps migrate data from old to new Supabase project.
 * 
 * Usage:
 *   1. Set environment variables for both old and new projects
 *   2. Run: npx tsx scripts/migrate-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const OLD_PROJECT_URL = process.env.OLD_SUPABASE_URL || '';
const OLD_SERVICE_KEY = process.env.OLD_SUPABASE_SERVICE_KEY || '';
const NEW_PROJECT_URL = process.env.NEW_SUPABASE_URL || '';
const NEW_SERVICE_KEY = process.env.NEW_SUPABASE_SERVICE_KEY || '';

const EXPORT_DIR = './migration-exports';

// Tables to migrate in order (to respect foreign key constraints)
const TABLES_ORDER = [
    'businesses',
    'customers',
    'products',
    'orders',
    'conversations',
    'order_items',
    'messages',
    'analytics_logs',
    'demand_predictions'
];

// Create Supabase clients
const oldSupabase = createClient(OLD_PROJECT_URL, OLD_SERVICE_KEY);
const newSupabase = createClient(NEW_PROJECT_URL, NEW_SERVICE_KEY);

/**
 * Export data from old project
 */
async function exportData() {
    console.log('🚀 Starting data export from old project...\n');

    // Create export directory
    if (!fs.existsSync(EXPORT_DIR)) {
        fs.mkdirSync(EXPORT_DIR, { recursive: true });
    }

    for (const table of TABLES_ORDER) {
        try {
            console.log(`📥 Exporting ${table}...`);

            const { data, error } = await oldSupabase
                .from(table)
                .select('*');

            if (error) {
                console.error(`❌ Error exporting ${table}:`, error.message);
                continue;
            }

            if (!data || data.length === 0) {
                console.log(`⚠️  ${table} is empty, skipping...`);
                continue;
            }

            // Save to JSON file
            const filePath = path.join(EXPORT_DIR, `${table}.json`);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

            console.log(`✅ Exported ${data.length} rows from ${table}\n`);
        } catch (err) {
            console.error(`❌ Failed to export ${table}:`, err);
        }
    }

    console.log('✨ Export completed!\n');
}

/**
 * Import data to new project
 */
async function importData() {
    console.log('🚀 Starting data import to new project...\n');

    if (!fs.existsSync(EXPORT_DIR)) {
        console.error('❌ Export directory not found. Please run export first.');
        return;
    }

    for (const table of TABLES_ORDER) {
        const filePath = path.join(EXPORT_DIR, `${table}.json`);

        if (!fs.existsSync(filePath)) {
            console.log(`⚠️  ${table}.json not found, skipping...`);
            continue;
        }

        try {
            console.log(`📤 Importing ${table}...`);

            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(fileContent);

            if (!data || data.length === 0) {
                console.log(`⚠️  ${table} data is empty, skipping...`);
                continue;
            }

            // Import in batches of 100 to avoid timeout
            const BATCH_SIZE = 100;
            let imported = 0;

            for (let i = 0; i < data.length; i += BATCH_SIZE) {
                const batch = data.slice(i, i + BATCH_SIZE);

                const { error } = await newSupabase
                    .from(table)
                    .insert(batch);

                if (error) {
                    console.error(`❌ Error importing batch to ${table}:`, error.message);
                    // Continue with next batch
                } else {
                    imported += batch.length;
                    console.log(`   Imported ${imported}/${data.length} rows...`);
                }
            }

            console.log(`✅ Imported ${imported} rows to ${table}\n`);
        } catch (err) {
            console.error(`❌ Failed to import ${table}:`, err);
        }
    }

    console.log('✨ Import completed!\n');
}

/**
 * Verify migration by comparing row counts
 */
async function verifyMigration() {
    console.log('🔍 Verifying migration...\n');
    console.log('Table'.padEnd(25) + 'Old Project'.padEnd(15) + 'New Project'.padEnd(15) + 'Status');
    console.log('-'.repeat(70));

    for (const table of TABLES_ORDER) {
        try {
            // Count in old project
            const { count: oldCount, error: oldError } = await oldSupabase
                .from(table)
                .select('*', { count: 'exact', head: true });

            // Count in new project
            const { count: newCount, error: newError } = await newSupabase
                .from(table)
                .select('*', { count: 'exact', head: true });

            if (oldError || newError) {
                console.log(
                    table.padEnd(25) +
                    'ERROR'.padEnd(15) +
                    'ERROR'.padEnd(15) +
                    '❌'
                );
                continue;
            }

            const status = oldCount === newCount ? '✅' : '⚠️';

            console.log(
                table.padEnd(25) +
                (oldCount || 0).toString().padEnd(15) +
                (newCount || 0).toString().padEnd(15) +
                status
            );
        } catch (err) {
            console.error(`Error verifying ${table}:`, err);
        }
    }

    console.log('\n✨ Verification completed!\n');
}

/**
 * Main function
 */
async function main() {
    const command = process.argv[2];

    // Validate environment variables
    if (!OLD_PROJECT_URL || !OLD_SERVICE_KEY) {
        console.error('❌ Missing old project credentials.');
        console.error('Please set OLD_SUPABASE_URL and OLD_SUPABASE_SERVICE_KEY');
        process.exit(1);
    }

    if (!NEW_PROJECT_URL || !NEW_SERVICE_KEY) {
        console.error('❌ Missing new project credentials.');
        console.error('Please set NEW_SUPABASE_URL and NEW_SUPABASE_SERVICE_KEY');
        process.exit(1);
    }

    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║   Supabase Data Migration Tool            ║');
    console.log('╚════════════════════════════════════════════╝\n');

    switch (command) {
        case 'export':
            await exportData();
            break;
        case 'import':
            await importData();
            break;
        case 'verify':
            await verifyMigration();
            break;
        case 'full':
            await exportData();
            await importData();
            await verifyMigration();
            break;
        default:
            console.log('Usage:');
            console.log('  npx tsx scripts/migrate-data.ts <command>');
            console.log('');
            console.log('Commands:');
            console.log('  export  - Export data from old project');
            console.log('  import  - Import data to new project');
            console.log('  verify  - Verify migration by comparing row counts');
            console.log('  full    - Run export, import, and verify');
            console.log('');
            console.log('Environment Variables Required:');
            console.log('  OLD_SUPABASE_URL');
            console.log('  OLD_SUPABASE_SERVICE_KEY');
            console.log('  NEW_SUPABASE_URL');
            console.log('  NEW_SUPABASE_SERVICE_KEY');
            break;
    }
}

// Run the script
main().catch(console.error);
