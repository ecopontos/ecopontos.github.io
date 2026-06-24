import fs from 'fs/promises';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const __dirname = path.resolve();
const dbPath = '\\\\192.168.12.1\\smmads\\Dep. Técnico\\Tecnicos_e_Administrativos\\TECNICOS_e_ADMINISTRATIVO\\Administrativo\\Bases de Dados\\banco\\ecoforms.sqlite';
const sqlPath = path.resolve(__dirname, 'scripts', 'sqlite-encarregado-migration.sql');

async function apply() {
  try {
    console.log('Opening DB:', dbPath);
    const db = await open({ filename: dbPath, driver: sqlite3.Database });

    const sql = await fs.readFile(sqlPath, 'utf8');
    console.log('Applying migration...');
    await db.exec(sql);

    console.log('Migration applied successfully. Verifying...');
    const auditCount = await db.get("SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='tbl_tasks_audit'");
    console.log('tbl_tasks_audit exists:', auditCount.cnt === 1);

    const user = await db.get("SELECT id, username, perfil FROM usuarios WHERE id = '00000000-0000-0000-0000-000000enc1'");
    console.log('Seed user:', user || 'NOT FOUND');

    await db.close();
  } catch (err) {
    console.error('Failed to apply migration:', err);
    process.exit(1);
  }
}

apply();