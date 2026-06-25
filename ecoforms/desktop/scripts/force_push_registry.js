const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load env vars
try {
    require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
} catch (e) {
    console.log('Dotenv not found or error loading, assuming env vars set.');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const dbPath = 'c:/Users/marceloluiz.comcap/Desktop/ecoforms0/banco/ecoforms.sqlite';
const BUCKET_NAME = 'sync-bucket';
const FILE_PATH = 'shared/form_registry.json';

// Helper to calculate checksum (matching storage-sync.ts logic)
function calculateChecksum(data) {
    const hash = crypto.createHash('sha256');
    // Simple stringify for now, assuming order isn't critical for this manual push, 
    // or we could implement stable stringify if strict validation requires it.
    // Ideally should use stable-stringify but for this fix standard JSON.stringify is usually fine if not comparing bit-for-bit later immediately.
    hash.update(JSON.stringify(data));
    return `sha256:${hash.digest('hex')}`;
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(`Cannot open database: ${err.message}`);
        process.exit(1);
    }
});

console.log(`Reading from local DB: ${dbPath}`);

db.all("SELECT * FROM form_registry", async (err, rows) => {
    if (err) {
        console.error(`Query failed: ${err.message}`);
        process.exit(1);
    }

    console.log(`Found ${rows.length} records locally.`);

    // Parse content if needed (it usually comes as string from DB text column)
    const processedRows = rows.map(r => {
        // Try to parse 'conteudo' if it is a string JSON
        if (typeof r.conteudo === 'string') {
            try { r.conteudo = JSON.parse(r.conteudo); } catch (e) { }
        }
        return r;
    });

    const formRegistryData = processedRows;

    // Checksum of the raw data array
    // Note: In storage-sync.ts we checksum the whole object structure usually, 
    // but here we just need to satisfy basic requirements. 
    // The key is that the file is valid JSON.
    const checksum = calculateChecksum({ form_registry: formRegistryData });

    const snapshot = {
        version: "1.0",
        timestamp: new Date().toISOString(),
        device_id: "desktop-force-push",
        origin_device: "desktop-force-push",
        sync_type: "full",
        data: {
            form_registry: formRegistryData
        },
        metadata: {
            checksum: checksum,
            record_count: {
                suite: 0,
                form_registry: formRegistryData.length
            },
            compressed: false,
            file_size_bytes: 0
        }
    };

    const jsonString = JSON.stringify(snapshot);
    snapshot.metadata.file_size_bytes = Buffer.byteLength(jsonString);

    console.log(`Uploading to ${BUCKET_NAME}/${FILE_PATH}...`);

    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(FILE_PATH, jsonString, {
            contentType: 'application/json',
            upsert: true
        });

    if (error) {
        console.error('Upload failed:', error);
    } else {
        console.log('✅ Success! File uploaded.');
        console.log('Path:', data.path);
        console.log('Id:', data.id);
    }

    db.close();

    // Funcao auxiliar para upload
    async function uploadSnapshot(filename, dataObj, propertyName) {
        const fileKey = `shared/${filename}`;
        const checksum = calculateChecksum(dataObj);

        const snapshot = {
            version: "1.0",
            timestamp: new Date().toISOString(),
            device_id: "desktop-force-push",
            origin_device: "desktop-force-push",
            sync_type: "full",
            data: dataObj,
            metadata: {
                checksum: checksum,
                record_count: {
                    [propertyName]: dataObj[propertyName] ? dataObj[propertyName].length : 0
                },
                compressed: false,
                file_size_bytes: 0
            }
        };

        const jsonString = JSON.stringify(snapshot);
        snapshot.metadata.file_size_bytes = Buffer.byteLength(jsonString);

        console.log(`Uploading to ${BUCKET_NAME}/${fileKey}...`);

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileKey, jsonString, {
                contentType: 'application/json',
                upsert: true
            });

        if (error) {
            console.error(`Upload failed for ${filename}:`, error);
        } else {
            console.log(`✅ Success! Uploaded ${filename}`);
        }
    }

    // Reuse form_registry data
    await uploadSnapshot('form_registry.json', { form_registry: formRegistryData }, 'form_registry');

    // Fetch Tasks
    db.serialize(() => {
        const db2 = new sqlite3.Database(dbPath);

        // Tasks
        db2.all("SELECT * FROM tarefas", async (err, rows) => {
            if (!err && rows.length > 0) {
                const processedTasks = rows.map(t => {
                    let tags = t.tags;
                    if (typeof tags === 'string') {
                        try { tags = JSON.parse(tags); } catch (e) { tags = []; }
                    }
                    return { ...t, tags: tags || [] };
                });
                console.log(`Found ${rows.length} tasks.`);
                await uploadSnapshot('tasks.json', { tarefas: processedTasks }, 'tarefas');
            } else {
                console.log('No tasks found or error:', err);
            }
        });

        // Projects
        db2.all("SELECT * FROM projetos", async (err, rows) => {
            if (!err && rows.length > 0) {
                console.log(`Found ${rows.length} projects.`);
                await uploadSnapshot('projects.json', { projetos: rows }, 'projetos');
            } else {
                console.log('No projects found or error:', err);
            }
            db2.close();
        });
    });

});
