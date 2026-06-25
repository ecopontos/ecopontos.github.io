import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugGallery() {
    console.log('🔍 Debugging Gallery Images...\n');
    console.log(`📡 Supabase URL: ${supabaseUrl}\n`);

    const bucketName = 'form-images';

    // 1. List all buckets first
    console.log('📦 Listing all buckets...');
    const { data: allBuckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
        console.error('❌ Error listing buckets:', bucketsError.message);
    } else {
        console.log(`   Found ${allBuckets.length} buckets:`);
        allBuckets.forEach(b => {
            console.log(`   - ${b.name} (public: ${b.public})`);
        });
    }

    console.log('\n📁 Listing files in root of form-images...');
    const { data: rootFiles, error: rootError } = await supabase.storage
        .from(bucketName)
        .list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

    if (rootError) {
        console.error('❌ Error listing root:', rootError.message);
        return;
    }

    console.log(`   Found ${rootFiles.length} items in root:`);
    rootFiles.forEach(file => {
        const isFolder = file.id === null;
        console.log(`   ${isFolder ? '📁' : '📄'} ${file.name} ${isFolder ? '(folder)' : `(${(file.metadata?.size || 0) / 1024} KB)`}`);
    });

    // 2. If there are folders (user IDs), list files in each folder
    const folders = rootFiles.filter(f => f.id === null);
    console.log(`\n📂 Found ${folders.length} user folders\n`);

    for (const folder of folders.slice(0, 3)) { // Check first 3 folders
        const folderName = folder.name;
        console.log(`\n📂 Folder: ${folderName}`);

        const { data: folderFiles, error: folderError } = await supabase.storage
            .from(bucketName)
            .list(folderName, { limit: 5, sortBy: { column: 'created_at', order: 'desc' } });

        if (folderError) {
            console.error(`   ❌ Error: ${folderError.message}`);
            continue;
        }

        console.log(`   Files: ${folderFiles.length}`);
        folderFiles.forEach(file => {
            const fullPath = `${folderName}/${file.name}`;
            const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(fullPath);

            console.log(`   📄 ${file.name}`);
            console.log(`      Size: ${((file.metadata?.size || 0) / 1024).toFixed(2)} KB`);
            console.log(`      Type: ${file.metadata?.mimetype || 'unknown'}`);
            console.log(`      URL: ${publicData.publicUrl}`);
        });
    }
}

debugGallery();
