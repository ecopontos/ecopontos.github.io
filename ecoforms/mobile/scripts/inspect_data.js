
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';

// Use the network path as seen in ClientLayout.tsx and debug-forms.js
const DB_PATH = '\\\\192.168.12.1\\smmads\\Dep. Técnico\\Tecnicos_e_Administrativos\\TECNICOS_e_ADMINISTRATIVO\\Administrativo\\Bases de Dados\\banco\\ecoforms.sqlite';

async function inspectData() {
    console.log(`📂 Connecting to database: ${DB_PATH}`);

    const db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });

    try {
        console.log('✅ Connected.');

        // 1. List all Registry Slugs
        console.log('\n--- Registry Slugs ---');
        const slugs = await db.all('SELECT slug, titulo FROM form_registry');
        slugs.forEach(s => console.log(`   Slug: "${s.slug}" - Title: "${s.titulo}"`));

        // 2. List all Suite Types
        console.log('\n--- Suite Form Types ---');
        const types = await db.all('SELECT DISTINCT tipo_form FROM suite');
        types.forEach(t => console.log(`   Type: "${t.tipo_form}"`));

        // 3. Inspect Data for Problematic Forms (using exact names found in step 1/2 if possible)
        const targetForms = ['solicitacaogeralForm', 'ecopontocaixasForm', 'praialixozeroForm'];

        for (const formType of targetForms) {
            console.log(`\n--- Inspecting ${formType} ---`);

            // Template
            // Try case insensitive match if direct fails
            let registry = await db.get('SELECT conteudo FROM form_registry WHERE slug = ?', formType);
            if (!registry) {
                const exactSlug = slugs.find(s => s.slug.toLowerCase() === formType.toLowerCase())?.slug;
                if (exactSlug) {
                    console.log(`⚠️ Match found with different casing: "${exactSlug}"`);
                    registry = await db.get('SELECT conteudo FROM form_registry WHERE slug = ?', exactSlug);
                }
            }

            if (registry) {
                try {
                    let content = registry.conteudo;
                    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
                    const finalContent = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;

                    if (finalContent.campos) {
                        const fields = finalContent.campos.map(f => `${f.id}`);
                        console.log('   Template Fields (IDs):', fields.join(', '));

                        // Also print labels to help matching
                        const labels = finalContent.campos.map(f => `${f.label}`);
                        console.log('   Template Labels:', labels.join(', '));
                    }
                } catch (e) {
                    console.log('   Error parsing template:', e.message);
                }
            } else {
                console.log('❌ Template NOT found.');
            }

            // Data
            const sample = await db.get('SELECT dados FROM suite WHERE tipo_form = ? LIMIT 1', formType);
            if (sample) {
                try {
                    let data = sample.dados;
                    const parsedData = typeof data === 'string' ? JSON.parse(data) : data;

                    // Show raw structure
                    console.log('   Root Keys:', Object.keys(parsedData).join(', '));

                    let formData = parsedData.form_data || parsedData;
                    console.log('   FormData Keys:', Object.keys(formData).join(', '));

                } catch (e) {
                    console.log('   Error parsing data:', e.message);
                }
            } else {
                console.log('❌ No records found.');
            }
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await db.close();
    }
}

inspectData();
