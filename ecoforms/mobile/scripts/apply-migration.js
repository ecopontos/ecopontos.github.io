#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const migrationPath = path.join(__dirname, '..', 'changes', '20260206_add_idempotency_tbl_tarefas.sql');
const dbPath = path.join(__dirname, '..', 'banco', 'ecoforms.sqlite');

if (!fs.existsSync(migrationPath)) {
  console.error('Migration file not found:', migrationPath);
  process.exit(1);
}
if (!fs.existsSync(dbPath)) {
  console.error('Database file not found:', dbPath);
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, 'utf8');

console.log('Applying migration:', migrationPath);
console.log('To database:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('Failed to open DB:', err.message);
    process.exit(1);
  }

  db.exec(sql, (err) => {
    if (err) {
      console.error('Migration failed:', err.message);
      db.close();
      process.exit(1);
    }
    console.log('Migration applied successfully.');
    db.close();
  });
});
