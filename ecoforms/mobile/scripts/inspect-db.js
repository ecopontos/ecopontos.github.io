import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = '\\\\192.168.12.1\\smmads\\Dep. Técnico\\Tecnicos_e_Administrativos\\TECNICOS_e_ADMINISTRATIVO\\Administrativo\\Bases de Dados\\banco\\ecoforms.sqlite';

async function inspectDatabase() {
    const db = await open({ filename: DB_PATH, driver: sqlite3.Database });

    console.log('--- Users ---');
    const users = await db.all('SELECT id, username FROM usuarios');
    users.forEach(u => console.log(`User: ${u.username}, ID: '${u.id}'`));

    console.log('\n--- Tasks ---');
    const tasks = await db.all('SELECT id, titulo, criado_por FROM tarefas');
    tasks.forEach(t => console.log(`Task: ${t.titulo}, ID: '${t.id}', Creator: '${t.criado_por}'`));

    await db.close();
}

inspectDatabase().catch(console.error);
