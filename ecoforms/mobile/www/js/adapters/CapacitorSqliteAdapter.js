/**
 * CapacitorSqliteAdapter
 *
 * Implementa SqlitePort (ecoforms-core/ports) sobre @capacitor-community/sqlite v8.
 * Usa a API direta via Capacitor.Plugins (sem bundler necessário).
 *
 * Pré-requisitos nativos (já executados):
 *   npm install @capacitor-community/sqlite@^8.1.0
 *   npx cap sync android
 *
 * ADR-052 — Fase 1
 */

const DB_NAME = 'ecoforms';
const DB_VERSION = 1;

export class CapacitorSqliteAdapter {
    #plugin = null;
    #opened = false;
    #initPromise = null;

    get #sqlite() {
        if (!this.#plugin) {
            this.#plugin = Capacitor.Plugins.CapacitorSQLite;
        }
        return this.#plugin;
    }

    /**
     * Abre a conexão com o banco. Idempotente.
     */
    async open() {
        if (this.#opened) return;
        if (this.#initPromise) return this.#initPromise;
        this.#initPromise = this.#doOpen();
        await this.#initPromise;
    }

    async #doOpen() {
        await this.#sqlite.createConnection({
            database: DB_NAME,
            encrypted: false,
            mode: 'no-encryption',
            version: DB_VERSION,
            readonly: false,
        });
        await this.#sqlite.open({ database: DB_NAME });
        this.#opened = true;
    }

    /** Fecha a conexão. Chame no logout. */
    async close() {
        if (!this.#opened) return;
        await this.#sqlite.close({ database: DB_NAME });
        await this.#sqlite.deleteConnection({ database: DB_NAME });
        this.#opened = false;
        this.#initPromise = null;
    }

    // ── SqlitePort ──────────────────────────────────────────────────

    /**
     * @template T
     * @param {string} sql
     * @param {unknown[]} [params]
     * @returns {Promise<T[]>}
     */
    async query(sql, params = []) {
        await this.open();
        const result = await this.#sqlite.query({
            database: DB_NAME,
            statement: sql,
            values: params,
        });
        return (result.values ?? []);
    }

    /** Alias de query — paridade com SqlitePort. */
    async all(sql, params = []) {
        return this.query(sql, params);
    }

    /**
     * @param {string} sql
     * @param {unknown[]} [params]
     */
    async execute(sql, params = []) {
        await this.open();
        await this.#sqlite.run({
            database: DB_NAME,
            statement: sql,
            values: params,
            transaction: false,
        });
    }

    /**
     * Executa callback dentro de uma transação com rollback automático.
     * @template T
     * @param {() => Promise<T>} callback
     * @returns {Promise<T>}
     */
    async transaction(callback) {
        await this.open();
        await this.#sqlite.beginTransaction({ database: DB_NAME });
        try {
            const result = await callback();
            await this.#sqlite.commitTransaction({ database: DB_NAME });
            return result;
        } catch (err) {
            await this.#sqlite.rollbackTransaction({ database: DB_NAME });
            throw err;
        }
    }
}

/** Instância singleton — use em todo o app mobile. */
export const sqliteAdapter = new CapacitorSqliteAdapter();
