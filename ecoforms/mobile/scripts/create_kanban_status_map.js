import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = '\\\\192.168.12.1\\smmads\\Dep. Técnico\\Tecnicos_e_Administrativos\\TECNICOS_e_ADMINISTRATIVO\\Administrativo\\Bases de Dados\\banco\\ecoforms.sqlite';

async function run() {
    console.log(`Connecting to database at ${dbPath}`);
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    const sql = `
    -- Drop existing table if exists (for idempotency)
    DROP TABLE IF EXISTS tbl_kanban_status_map;

    -- Create status mapping table
    CREATE TABLE tbl_kanban_status_map (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        kanban_status TEXT NOT NULL,
        form_status TEXT NOT NULL,
        direction TEXT DEFAULT 'bidirectional', -- 'bidirectional', 'form_to_kanban', 'kanban_to_form'
        is_active INTEGER DEFAULT 1, -- SQLite uses INTEGER for boolean (0=false, 1=true)
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(kanban_status, form_status)
    );

    -- Insert default mappings
    INSERT INTO tbl_kanban_status_map (kanban_status, form_status, direction)
    VALUES 
        ('concluido', 'approved', 'bidirectional'),
        ('em_progresso', 'in_review', 'bidirectional'),
        ('a_fazer', 'submitted', 'bidirectional'),
        ('concluido', 'rejected', 'form_to_kanban') -- Rejected forms archive tasks (one-way)
    ON CONFLICT (kanban_status, form_status) DO NOTHING;

    -- Create index for fast lookups
    CREATE INDEX IF NOT EXISTS idx_status_map_kanban ON tbl_kanban_status_map(kanban_status, is_active);
    CREATE INDEX IF NOT EXISTS idx_status_map_form ON tbl_kanban_status_map(form_status, is_active);
    `;

    try {
        await db.exec(sql);
        console.log('✅ Successfully created tbl_kanban_status_map with default mappings');
        
        // Verify data
        const mappings = await db.all('SELECT * FROM tbl_kanban_status_map');
        console.log('\n📋 Current status mappings:');
        mappings.forEach(m => {
            console.log(`  ${m.kanban_status} ↔ ${m.form_status} (${m.direction})`);
        });
    } catch (err) {
        console.error('❌ Error creating status mapping table:', err);
    } finally {
        await db.close();
    }
}

run();
