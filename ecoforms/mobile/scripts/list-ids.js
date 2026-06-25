import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = '\\\\192.168.12.1\\smmads\\Dep. Técnico\\Tecnicos_e_Administrativos\\TECNICOS_e_ADMINISTRATIVO\\Administrativo\\Bases de Dados\\banco\\ecoforms.sqlite';

async function listIds() {
    const db = await open({ filename: DB_PATH, driver: sqlite3.Database });

    console.log('--- ALL USERS ---');
    const users = await db.all('SELECT id, username FROM usuarios');
    users.forEach(u => console.log(`[USER] ${u.username}: ${u.id}`));

    console.log('\n--- ALL TASKS ---');
    const tasks = await db.all('SELECT id, titulo FROM tarefas');
    tasks.forEach(t => console.log(`[TASK] ${t.titulo}: ${t.id}`));

    await db.close();
}

listIds().catch(console.error);
