/**
 * cleanup-remote-dispatches.js
 * 
 * Remove all dispatch-related files from Supabase Storage (sync-bucket).
 * Paths cleaned:
 *   - orders/                          (legacy dispatch packages)
 *   - devices/*/outbox/dispatch_*      (auto-receive packages per device)
 *   - cancelled-dispatches/            (cancellation markers)
 *   - dispatch-receipts/               (mobile ACK receipts)
 *   - archive/dispatch-results/        (archived dispatch results)
 *
 * Usage:
 *   node scripts/cleanup-remote-dispatches.js
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_KEY env vars (or .env file).
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Try loading .env from project root
try { require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') }); } catch (_) { /* dotenv optional */ }

const BUCKET = 'sync-bucket';
const BATCH_SIZE = 100; // Supabase Storage remove limit per call

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY env vars are required.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listAllFiles(folder) {
    const allFiles = [];
    let offset = 0;
    const limit = 1000;

    while (true) {
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .list(folder, { limit, offset });

        if (error) {
            console.warn(`⚠️  Error listing ${folder}:`, error.message);
            break;
        }
        if (!data || data.length === 0) break;

        for (const item of data) {
            // Skip folder placeholders (.emptyFolderPlaceholder)
            if (item.id) {
                allFiles.push(`${folder}/${item.name}`);
            }
        }

        if (data.length < limit) break;
        offset += limit;
    }

    return allFiles;
}

async function listDeviceOutboxDispatches() {
    // List all device folders first
    const { data: devices, error } = await supabase.storage
        .from(BUCKET)
        .list('devices', { limit: 1000 });

    if (error || !devices) return [];

    const files = [];
    for (const device of devices) {
        if (!device.id && device.name) {
            // It's a subfolder (device ID)
            const outboxFiles = await listAllFiles(`devices/${device.name}/outbox`);
            for (const f of outboxFiles) {
                if (f.includes('/dispatch_')) {
                    files.push(f);
                }
            }
        }
    }
    return files;
}

async function removeFiles(filePaths) {
    if (filePaths.length === 0) return 0;

    let removed = 0;
    for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
        const batch = filePaths.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.storage.from(BUCKET).remove(batch);
        if (error) {
            console.warn(`⚠️  Error removing batch at offset ${i}:`, error.message);
        } else {
            removed += batch.length;
        }
    }
    return removed;
}

async function main() {
    console.log('🧹 Dispatch Module Cleanup — Supabase Storage');
    console.log(`   Bucket: ${BUCKET}`);
    console.log(`   URL:    ${supabaseUrl}`);
    console.log('');

    const targets = [
        { label: 'orders/', fn: () => listAllFiles('orders') },
        { label: 'cancelled-dispatches/', fn: () => listAllFiles('cancelled-dispatches') },
        { label: 'dispatch-receipts/', fn: () => listAllFiles('dispatch-receipts') },
        { label: 'archive/dispatch-results/', fn: () => listAllFiles('archive/dispatch-results') },
        { label: 'devices/*/outbox/dispatch_*', fn: () => listDeviceOutboxDispatches() },
    ];

    let totalRemoved = 0;

    for (const target of targets) {
        process.stdout.write(`  Scanning ${target.label} ... `);
        const files = await target.fn();
        console.log(`${files.length} file(s) found`);

        if (files.length > 0) {
            const removed = await removeFiles(files);
            console.log(`    ✅ Removed ${removed}/${files.length}`);
            totalRemoved += removed;
        }
    }

    console.log('');
    console.log(`🏁 Done. Total files removed: ${totalRemoved}`);
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
