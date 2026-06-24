import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'ecoforms.sqlite');
console.log('Connecting to:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Error opening DB:', err.message);
        return;
    }

    db.all("SELECT id, username, nome, perfil FROM usuarios LIMIT 10", (err, rows) => {
        if (err) {
            console.error('Error querying usuarios:', err.message);
        } else {
            console.table(rows);
        }
        db.close();
    });
});
