/**
 * Wrapper para SQLite com suporte a diferentes adaptadores
 * (Tauri, mobile, etc)
 */

export interface DBAdapter {
    exec(sql: string, params?: unknown[]): Promise<unknown>;
    all<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
}

export class SQLiteDBWrapper {
    private adapter: DBAdapter;
    private inTransaction: boolean = false;

    constructor(adapter: DBAdapter) {
        this.adapter = adapter;
    }

    async exec(sql: string, params: unknown[] = []): Promise<void> {
        // Garantir que parametros undefined sejam tratados
        const safeParams = params || [];
        await this.adapter.exec(sql, safeParams);
    }

    async all<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
        const safeParams = params || [];
        return this.adapter.all<T>(sql, safeParams);
    }

    // Alias para compatibilidade
    async execute(sql: string, params: unknown[] = []): Promise<void> {
        return this.exec(sql, params);
    }

    async query<T = unknown>(sql: string, params: unknown[] = [], _options?: { bootstrap?: boolean }): Promise<T[]> {
        return this.all<T>(sql, params);
    }

    // Get single row
    async get<T = unknown>(sql: string, params: unknown[] = []): Promise<T | undefined> {
        const results = await this.all<T>(sql, params);
        return results[0];
    }

    // Transaction support
    async beginTransaction(): Promise<void> {
        await this.exec('BEGIN TRANSACTION');
        this.inTransaction = true;
    }

    async commit(): Promise<void> {
        await this.exec('COMMIT');
        this.inTransaction = false;
    }

    async rollback(): Promise<void> {
        await this.exec('ROLLBACK');
        this.inTransaction = false;
    }

    async transaction<T>(callback: (tx: SQLiteDBWrapper) => Promise<T>): Promise<T> {
        await this.beginTransaction();
        try {
            const result = await callback(this);
            await this.commit();
            return result;
        } catch (error) {
            await this.rollback();
            throw error;
        }
    }

    isInTransaction(): boolean {
        return this.inTransaction;
    }
}
