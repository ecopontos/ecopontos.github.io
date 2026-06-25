import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const possiblePaths = [
    'ecoforms.sqlite',
    'desktop/desktop.db',
    'desktop/data.db',
    'desktop/ecoforms.sqlite'
];

async function checkDb(dbPath) {
    const fullPath = path.join(process.cwd(), dbPath);
    if (!fs.existsSync(fullPath)) {
        console.log(`❌ ${dbPath} does not exist`);
        return;
    }

    console.log(`\n🔍 Checking ${dbPath}...`);
    return new Promise((resolve) => {
        const db = new sqlite3.Database(fullPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.log(`❌ Error opening ${dbPath}:`, err.message);
                resolve();
                return;
            }

            db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
                if (err) {
                    console.log(`❌ Error querying ${dbPath}:`, err.message);
                } else if (rows.length === 0) {
                    console.log(`⚠️  ${dbPath} is EMPTY`);
                } else {
                    console.log(`✅ ${dbPath} contains tables:`, rows.map(r => r.name).join(', '));
                }
                db.close();
                resolve();
            });
        });
    });
}

async function run() {
    for (const p of possiblePaths) {
        await checkDb(p);
    }
}

run();
