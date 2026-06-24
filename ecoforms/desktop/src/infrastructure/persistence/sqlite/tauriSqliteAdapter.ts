import { invoke } from '@tauri-apps/api/core';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

interface TauriQueryResult {
    columns?: string[];
    rows?: unknown[][];
}

export class TauriSqliteAdapter implements SqlitePort {
    private inTransaction = false;

    async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
        return this.all<T>(sql, params);
    }

    async all<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
        const result = await invoke<TauriQueryResult>('db_query', { sql, params });
        if (!result.columns || !result.rows) return [];
        return result.rows.map((row) => {
            const obj: Record<string, unknown> = {};
            result.columns!.forEach((col, i) => {
                obj[col] = row[i];
            });
            return obj as T;
        });
    }

    async execute(sql: string, params: unknown[] = [], options?: { bootstrap?: boolean }): Promise<void> {
        await invoke('db_execute', { sql, params, bootstrap: options?.bootstrap ?? false });
    }

    async transaction<T>(callback: () => Promise<T>): Promise<T> {
        if (this.inTransaction) return callback();
        await this.execute('BEGIN TRANSACTION');
        this.inTransaction = true;
        try {
            const result = await callback();
            await this.execute('COMMIT');
            return result;
        } catch (error) {
            await this.execute('ROLLBACK');
            throw error;
        } finally {
            this.inTransaction = false;
        }
    }
}
