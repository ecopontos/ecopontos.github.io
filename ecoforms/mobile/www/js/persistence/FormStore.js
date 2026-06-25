class FormStore {
    constructor() {
        this.db = null;
        this.SQL = null;
    }

    async init() {
        if (this.db) return this.db;
        const init = typeof initSqlJs === 'function' ? initSqlJs : (await import('sql.js')).default;
        this.SQL = await init();
        this.db = new this.SQL.Database();
        this._createTables();
        return this.db;
    }

    _createTables() {
        this.db.run(`CREATE TABLE IF NOT EXISTS form_store (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_key TEXT UNIQUE,
            data TEXT NOT NULL,
            formId TEXT,
            syncStatus TEXT DEFAULT 'pending',
            tipoForm TEXT,
            activityId TEXT,
            uuid TEXT,
            createdAt TEXT,
            updatedAt TEXT
        )`);
        this.db.run('CREATE INDEX IF NOT EXISTS idx_fs_formId ON form_store(formId)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_fs_syncStatus ON form_store(syncStatus)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_fs_activityId ON form_store(activityId)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_fs_uuid ON form_store(uuid)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_fs_store_key ON form_store(store_key)');

        this.db.run(`CREATE TABLE IF NOT EXISTS sync_idempotency (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recordUUID TEXT UNIQUE,
            method TEXT,
            success INTEGER DEFAULT 0,
            syncAttemptTime TEXT,
            checksum TEXT DEFAULT ''
        )`);
        this.db.run('CREATE INDEX IF NOT EXISTS idx_si_uuid ON sync_idempotency(recordUUID)');

        this.db.run(`CREATE TABLE IF NOT EXISTS form_field_registry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            formId TEXT UNIQUE,
            fields TEXT,
            cachedAt TEXT
        )`);
        this.db.run('CREATE INDEX IF NOT EXISTS idx_ffr_formId ON form_field_registry(formId)');
    }

    _storeRow(data) {
        const json = JSON.stringify(data);
        const formId = data.formId || data.tipoForm || null;
        const syncStatus = data.syncStatus || 'pending';
        const tipoForm = data.tipoForm || data.formId || null;
        const activityId = data.activityId || data.activity_id || null;
        const uuid = data.uuid || null;
        const createdAt = data.createdAt || null;
        const updatedAt = data.updatedAt || null;
        return { json, formId, syncStatus, tipoForm, activityId, uuid, createdAt, updatedAt };
    }

    _rowToData(row) {
        if (!row) return null;
        const data = JSON.parse(row.data);
        data.id = data.id ?? row.store_key ?? String(row.id);
        return data;
    }

    _rowsToList(rows) {
        return rows.map(r => this._rowToData(r));
    }

    async save(data) {
        await this.init();
        const { json, formId, syncStatus, tipoForm, activityId, uuid, createdAt, updatedAt } = this._storeRow(data);
        const stmt = this.db.prepare(`INSERT INTO form_store (data, formId, syncStatus, tipoForm, activityId, uuid, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        stmt.run([json, formId, syncStatus, tipoForm, activityId, uuid, createdAt, updatedAt]);
        stmt.free();
        return this.db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
    }

    async getById(id) {
        await this.init();
        const numId = parseInt(id);
        const row = this.db.exec(
            `SELECT * FROM form_store WHERE id = ? OR store_key = ? LIMIT 1`,
            [numId, String(id)]
        );
        if (!row.length || !row[0].values.length) return null;
        return this._rowToData(this._execRow('form_store', row));
    }

    async getByFormId(formId) {
        await this.init();
        const rows = this.db.exec(`SELECT * FROM form_store WHERE formId = ?`, [formId]);
        return this._execRows('form_store', rows);
    }

    async getByActivityId(activityId) {
        await this.init();
        const rows = this.db.exec(`SELECT * FROM form_store WHERE activityId = ?`, [activityId]);
        return this._execRows('form_store', rows);
    }

    async getAll() {
        await this.init();
        const rows = this.db.exec(`SELECT * FROM form_store`);
        return this._execRows('form_store', rows);
    }

    async getBySyncStatus(status) {
        await this.init();
        const rows = this.db.exec(`SELECT * FROM form_store WHERE syncStatus = ?`, [status]);
        return this._execRows('form_store', rows);
    }

    async getByKey(key) {
        await this.init();
        const row = this.db.exec(`SELECT * FROM form_store WHERE store_key = ? LIMIT 1`, [String(key)]);
        if (!row.length || !row[0].values.length) return null;
        return this._rowToData(this._execRow('form_store', row));
    }

    async put(data) {
        await this.init();
        const storeKey = data.id ? String(data.id) : null;
        const { json, formId, syncStatus, tipoForm, activityId, uuid, createdAt, updatedAt } = this._storeRow(data);
        if (storeKey) {
            const existing = this.db.exec(`SELECT id FROM form_store WHERE store_key = ? LIMIT 1`, [storeKey]);
            if (existing.length && existing[0].values.length) {
                const stmt = this.db.prepare(`UPDATE form_store SET data=?, formId=?, syncStatus=?, tipoForm=?, activityId=?, uuid=?, createdAt=?, updatedAt=? WHERE store_key=?`);
                stmt.run([json, formId, syncStatus, tipoForm, activityId, uuid, createdAt, updatedAt, storeKey]);
                stmt.free();
            } else {
                const stmt = this.db.prepare(`INSERT INTO form_store (store_key, data, formId, syncStatus, tipoForm, activityId, uuid, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                stmt.run([storeKey, json, formId, syncStatus, tipoForm, activityId, uuid, createdAt, updatedAt]);
                stmt.free();
            }
        } else {
            const stmt = this.db.prepare(`INSERT INTO form_store (data, formId, syncStatus, tipoForm, activityId, uuid, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
            stmt.run([json, formId, syncStatus, tipoForm, activityId, uuid, createdAt, updatedAt]);
            stmt.free();
        }
        return storeKey;
    }

    async updateSyncStatus(recordId, status) {
        await this.init();
        const row = this.db.exec(`SELECT * FROM form_store WHERE id=? OR store_key=? LIMIT 1`, [parseInt(recordId), String(recordId)]);
        if (!row.length || !row[0].values.length) return;
        const obj = this._rowToData(this._execRow('form_store', row));
        obj.syncStatus = status;
        obj.updatedAt = new Date().toISOString();
        const updatedAt = obj.updatedAt;
        this.db.run(`UPDATE form_store SET data=?, syncStatus=?, updatedAt=? WHERE id=?`,
            [JSON.stringify(obj), status, updatedAt, row[0].values[0][0]]);
    }

    async updateRecordStatus(recordId, status) {
        await this.init();
        const row = this.db.exec(`SELECT * FROM form_store WHERE id=? OR store_key=? LIMIT 1`, [parseInt(recordId), String(recordId)]);
        if (!row.length || !row[0].values.length) throw new Error('Registro não encontrado');
        const data = this._rowToData(this._execRow('form_store', row));
        data.status = status;
        data.updatedAt = new Date().toISOString();
        this.db.run(`UPDATE form_store SET data=?, updatedAt=? WHERE id=?`, [JSON.stringify(data), data.updatedAt, row[0].values[0][0]]);
    }

    async delete(id) {
        await this.init();
        const numId = parseInt(id);
        this.db.run(`DELETE FROM form_store WHERE id=? OR store_key=?`, [numId, String(id)]);
    }

    async cleanupSynced() {
        await this.init();
        this.db.run(`DELETE FROM form_store WHERE syncStatus='synced'`);
        return this.db.exec('SELECT changes() as count')[0].values[0][0];
    }

    async getStats() {
        await this.init();
        const total = this.db.exec(`SELECT COUNT(*) as c FROM form_store`)[0].values[0][0];
        const pending = this.db.exec(`SELECT COUNT(*) as c FROM form_store WHERE syncStatus='pending'`)[0].values[0][0];
        const synced = this.db.exec(`SELECT COUNT(*) as c FROM form_store WHERE syncStatus='synced'`)[0].values[0][0];
        const errors = this.db.exec(`SELECT COUNT(*) as c FROM form_store WHERE syncStatus='error'`)[0].values[0][0];
        const byFormRows = this.db.exec(`SELECT tipoForm, syncStatus, COUNT(*) as c FROM form_store GROUP BY tipoForm, syncStatus`);
        const byForm = {};
        if (byFormRows.length) {
            const cols = byFormRows[0].columns;
            for (const row of byFormRows[0].values) {
                const formType = row[cols.indexOf('tipoForm')] || 'unknown';
                const st = row[cols.indexOf('syncStatus')] || 'unknown';
                const count = row[cols.indexOf('c')];
                if (!byForm[formType]) byForm[formType] = { total: 0, pending: 0, synced: 0, errors: 0 };
                byForm[formType][st] = count;
                byForm[formType].total += count;
            }
        }
        return { total, pending, synced, errors, byForm };
    }

    async recordSyncAttempt(recordUUID, method, success) {
        await this.init();
        this.db.run(`INSERT OR IGNORE INTO sync_idempotency (recordUUID, method, success, syncAttemptTime) VALUES (?, ?, ?, ?)`,
            [recordUUID, method, success ? 1 : 0, new Date().toISOString()]);
    }

    async checkSyncIdempotency(recordUUID) {
        await this.init();
        const rows = this.db.exec(`SELECT success FROM sync_idempotency WHERE recordUUID=?`, [recordUUID]);
        if (!rows.length || !rows[0].values.length) return false;
        return rows[0].values[0][0] === 1;
    }

    async cacheFormSchema(formId, fields) {
        await this.init();
        const existing = this.db.exec(`SELECT id FROM form_field_registry WHERE formId=? LIMIT 1`, [formId]);
        if (existing.length && existing[0].values.length) {
            this.db.run(`UPDATE form_field_registry SET fields=?, cachedAt=? WHERE formId=?`,
                [JSON.stringify(fields), new Date().toISOString(), formId]);
        } else {
            this.db.run(`INSERT INTO form_field_registry (formId, fields, cachedAt) VALUES (?, ?, ?)`,
                [formId, JSON.stringify(fields), new Date().toISOString()]);
        }
    }

    async getCachedFormSchema(formId) {
        await this.init();
        const rows = this.db.exec(`SELECT * FROM form_field_registry WHERE formId=? LIMIT 1`, [formId]);
        if (!rows.length || !rows[0].values.length) return null;
        const cols = rows[0].columns;
        const vals = rows[0].values[0];
        const fields = JSON.parse(vals[cols.indexOf('fields')]);
        const cachedAt = vals[cols.indexOf('cachedAt')];
        const cacheAge = Date.now() - new Date(cachedAt).getTime();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        if (cacheAge < sevenDaysMs) return fields;
        return fields;
    }

    _execRows(table, result) {
        if (!result.length) return [];
        const cols = result[0].columns;
        return result[0].values.map(vals => {
            const obj = {};
            cols.forEach((c, i) => { obj[c] = vals[i]; });
            return this._rowToData(obj);
        });
    }

    _execRow(table, result) {
        if (!result.length || !result[0].values.length) return null;
        const cols = result[0].columns;
        const vals = result[0].values[0];
        const obj = {};
        cols.forEach((c, i) => { obj[c] = vals[i]; });
        return obj;
    }
}

if (typeof window !== 'undefined') {
    window.FormStore = FormStore;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FormStore };
}
