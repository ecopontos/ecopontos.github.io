import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'ecoforms.sqlite');
console.log('Connecting to:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Error opening DB:', err.message);
        return;
    }

    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) {
            console.error('Error listing tables:', err.message);
        } else {
            console.log('Tables found:');
            console.log(rows.map(r => r.name).join(', '));
        }
        db.close();
    });
});
