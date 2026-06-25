
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env from .env.local manually since we are running with node
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim();
    }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // Use anon key to test realistic client access

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing credentials in .env.local');
    process.exit(1);
}

console.log(`Using Supabase URL: ${supabaseUrl}`);

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStorage() {
    console.log('🔄 Checking Storage Buckets...');

    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
        console.error('❌ Failed to list buckets:', error);
        if (error.message && error.message.includes('Unexpected token')) {
            console.error('   This confirms the HTML response issue. Likely URL is wrong or project is paused.');
        }
        return;
    }

    console.log('✅ Buckets found:', buckets.map(b => b.name));

    const bucketName = 'sync-bucket';
    const syncBucket = buckets.find(b => b.name === bucketName);

    if (!syncBucket) {
        console.warn(`⚠️ Bucket '${bucketName}' NOT FOUND!`);
        console.log(`   Attempting to create '${bucketName}'...`);

        // Try to create (might fail with anon key depending on policies, usually needs service_role)
        // We can try with service role if available
        const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceKey) {
            const adminClient = createClient(supabaseUrl, serviceKey);
            const { data, error: createError } = await adminClient.storage.createBucket(bucketName, {
                public: false,
                fileSizeLimit: 52428800
            });

            if (createError) {
                console.error('❌ Failed to create bucket (even with service role):', createError);
            } else {
                console.log('✅ Bucket created successfully using Service Role!');
            }
        } else {
            console.warn('   Cannot attempt creation: Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
        }

    } else {
        console.log(`✅ Bucket '${bucketName}' exists.`);

        // Test upload
        console.log('🔄 Testing upload...');
        const { data, error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload('test-verify.txt', 'Verified!', { upsert: true });

        if (uploadError) {
            console.error('❌ Upload failed:', uploadError);
        } else {
            console.log('✅ Upload successful:', data);
        }
    }
}

checkStorage();
