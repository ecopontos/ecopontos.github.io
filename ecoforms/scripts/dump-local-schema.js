#!/usr/bin/env node
const sqlite3 = require('sqlite3');

const dbPath = process.argv[2];
if (!dbPath) {
    console.error('Usage: node scripts/dump-local-schema.js <path/to/ecoforms.db> > local_db_schema.json');
    process.exit(1);
}

const db = new sqlite3.Database(dbPath);
db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name", (err, tables) => {
    if (err) throw err;
    const out = {};
    let pending = tables.length;
    const done = () => { process.stdout.write(JSON.stringify(out, null, 2) + '\n'); db.close(); };
    if (pending === 0) return done();
    tables.forEach((t) => {
        db.all(`PRAGMA table_info(${t.name})`, (e, cols) => {
            if (e) throw e;
            out[t.name] = cols.map((c) => ({
                table_name: t.name,
                column_name: c.name,
                data_type: c.type,
                is_nullable: c.notnull ? 'NO' : 'YES',
                column_default: c.dflt,
            }));
            if (--pending === 0) done();
        });
    });
});
