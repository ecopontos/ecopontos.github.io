
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';

const DB_PATH = '\\\\192.168.12.1\\smmads\\Dep. Técnico\\Tecnicos_e_Administrativos\\TECNICOS_e_ADMINISTRATIVO\\Administrativo\\Bases de Dados\\banco\\ecoforms.sqlite';

async function listNames() {
    console.log(`📂 Connecting to database...`);
    const db = await open({ filename: DB_PATH, driver: sqlite3.Database });

    try {
        console.log('✅ Connected.');

        const slugs = (await db.all('SELECT slug FROM form_registry')).map(s => s.slug);
        const types = (await db.all('SELECT DISTINCT tipo_form FROM suite')).map(t => t.tipo_form);

        console.log('\n=== FORM REGISTRY SLUGS ===');
        console.log(JSON.stringify(slugs.sort(), null, 2));

        console.log('\n=== TBL_SUITE TYPES ===');
        console.log(JSON.stringify(types.sort(), null, 2));

        const intersection = types.filter(t => slugs.includes(t));
        const missingInRegistry = types.filter(t => !slugs.includes(t));

        console.log('\n=== ANALYSIS ===');
        console.log(`Matched: ${intersection.length}`);
        console.log(`Missing in Registry: ${missingInRegistry.length}`);
        if (missingInRegistry.length > 0) {
            console.log('Types in Suite but NOT in Registry:', missingInRegistry);
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await db.close();
    }
}

listNames();
