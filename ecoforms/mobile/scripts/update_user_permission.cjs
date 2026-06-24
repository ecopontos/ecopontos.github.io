
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../banco/ecoforms.sqlite');
const db = new sqlite3.Database(dbPath);

const userName = 'Charlei';

// Update to 'Gerente' for full access
const sql = `UPDATE tbl_usuarios SET perfil = 'Gerente' WHERE nome LIKE ?`;

db.run(sql, [`%${userName}%`], function (err) {
    if (err) {
        console.error('Error updating database:', err);
        return;
    }
    console.log(`Row(s) updated: ${this.changes}`);

    // Check results
    db.all(`SELECT * FROM tbl_usuarios WHERE nome LIKE ?`, [`%${userName}%`], (err, rows) => {
        if (err) {
            console.error('Error querying database:', err);
            return;
        }
        console.log('User Data Updated:', JSON.stringify(rows, null, 2));
        db.close();
    });
});
