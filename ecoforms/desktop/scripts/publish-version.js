const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BUCKET_NAME = 'sync-bucket'; // Adjust if different

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const versionData = {
    version: process.argv[2], // e.g. "1.0.2"
    release_date: new Date().toISOString(),
    notes: process.argv[3] || "Atualização de melhorias e correções.",
    force_update: process.argv.includes('--force'),
    download_url: "https://install.appcenter.ms/users/..." // Replace with actual URL or allow arg
};

if (!versionData.version) {
    console.error('❌ Usage: node publish-version.js <version> [notes] [--force]');
    process.exit(1);
}

async function publishVersion() {
    console.log(`🚀 Publishing version ${versionData.version}...`);

    const { error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .upload('shared/app-version.json', JSON.stringify(versionData, null, 2), {
            contentType: 'application/json',
            upsert: true
        });

    if (error) {
        console.error('❌ Error publishing version:', error);
    } else {
        console.log('✅ Version published successfully!');
        console.log(versionData);
    }
}

publishVersion();
