
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from desktop/.env.local or root .env
const envPaths = [
    path.join(__dirname, '../desktop/.env.local'),
    path.join(__dirname, '../.env')
];

let envLoaded = false;
for (const p of envPaths) {
    if (fs.existsSync(p)) {
        console.log(`Loading env from ${p}`);
        dotenv.config({ path: p });
        envLoaded = true;
    }
}

if (!envLoaded) {
    console.warn("⚠️ No .env file found. Expecting environment variables to be set.");
}

// Check keys
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vnnimekczkxkpckrydnc.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const fallbackKey = 'REDACTED_SERVICE_ROLE_KEY';

console.log(`Debug: URL: ${url ? 'Set' : 'Missing'}`);
console.log(`Debug: Service Key: ${serviceKey ? 'Set' : 'Missing'}`);
console.log(`Debug: Anon Key: ${anonKey ? 'Set' : 'Missing'}`);
console.log(`Debug: Fallback Key: Set`);

const supabaseKey = fallbackKey; // Force the known hardcoded key for now to bypass potential bad env vars

if (!url || !supabaseKey) {
    console.error('❌ Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
}

const supabase = createClient(url, supabaseKey);

const REMOTE_DB_PATH = '\\\\192.168.12.1\\smmads\\Dep. Técnico\\Tecnicos_e_Administrativos\\TECNICOS_e_ADMINISTRATIVO\\Administrativo\\Bases de Dados\\banco\\ecoforms.sqlite';
const BUCKET_NAME = 'sync-bucket';
const FILE_PATH = 'shared/form_registry.json';

function calculateChecksum(data) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    return `sha256:${hash.digest('hex')}`;
}

async function sync() {
    console.log(`🔌 Connecting to Remote DB: ${REMOTE_DB_PATH}`);
    
    let db;
    try {
        db = await open({
            filename: REMOTE_DB_PATH,
            driver: sqlite3.Database
        });
    } catch (e) {
        console.error('❌ Failed to connect to remote DB:', e);
        process.exit(1);
    }

    console.log('📖 Reading form_registry table...');
    let rows;
    try {
        rows = await db.all('SELECT * FROM form_registry');
    } catch (e) {
        console.error('❌ Failed to read form_registry:', e);
        await db.close();
        process.exit(1);
    }
    
    await db.close();
    console.log(`✅ Read ${rows.length} rows.`);

    // Transform data
    const processedRows = rows.map(r => {
        // Parse content if string
        if (typeof r.conteudo === 'string') {
            try { 
                r.conteudo = JSON.parse(r.conteudo); 
            } catch (e) { 
                console.warn(`⚠️ Failed to parse JSON content for form ${r.form_id || r.id}`);
            }
        }
        return r;
    });

    // Prepare Payload
    const dataObj = { form_registry: processedRows };
    const checksum = calculateChecksum(dataObj);
    
    const snapshot = {
        version: "1.0",
        timestamp: new Date().toISOString(),
        device_id: "sync-script-cli",
        origin_device: "desktop",
        sync_type: "full",
        data: dataObj,
        metadata: {
            checksum: checksum,
            record_count: {
                form_registry: processedRows.length
            },
            compressed: false
        }
    };

    const jsonString = JSON.stringify(snapshot); // Minified for upload
    const jsonStringPretty = JSON.stringify(snapshot, null, 2);
    
    console.log(`📤 Uploading to Supabase Storage: ${BUCKET_NAME}/${FILE_PATH}`);
    
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(FILE_PATH, jsonString, {
            contentType: 'application/json',
            upsert: true
        });

    if (error) {
        console.error('❌ Upload failed:', error);
        console.error('   Status:', error.status || error.statusCode);
        console.error('   Message:', error.message);
        process.exit(1);
    }
    
    console.log('✅ Upload successful!');
    console.log('   Path:', data.path);
    console.log('   ID:', data.id);

    // Save locally
    const localDir = path.join(__dirname, '../banco');
    if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
    }
    const localSavedPath = path.join(localDir, 'form_registry_synced.json');
    fs.writeFileSync(localSavedPath, jsonStringPretty);
    console.log(`💾 Saved local copy to ${localSavedPath}`);
}

sync().catch(console.error);
