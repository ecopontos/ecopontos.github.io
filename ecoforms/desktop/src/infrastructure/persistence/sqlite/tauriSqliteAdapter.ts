import { invoke } from '@tauri-apps/api/core';
import type { SqliteBatchStatement, SqlitePort, SqliteQueryOptions } from '../../../application/ports/SqlitePort';

interface TauriQueryResult {
    columns?: string[];
    rows?: unknown[][];
}

export class TauriSqliteAdapter implements SqlitePort {
    private static queue: Promise<void> = Promise.resolve();
    private static activeTransaction: SqlitePort | null = null;

    private async withLock<T>(fn: () => Promise<T>): Promise<T> {
        let release!: () => void;
        const previous = TauriSqliteAdapter.queue;
        TauriSqliteAdapter.queue = new Promise<void>((resolve) => {
            release = resolve;
        });
        await previous;
        try {
            return await fn();
        } finally {
            release();
        }
    }

    private async queryDirect<T = unknown>(sql: string, params: unknown[] = [], options?: SqliteQueryOptions): Promise<T[]> {
        const result = await invoke<TauriQueryResult>('db_query', { sql, params, bootstrap: options?.bootstrap ?? false });
        if (!result.columns || !result.rows) return [];
        return result.rows.map((row) => {
            const obj: Record<string, unknown> = {};
            result.columns!.forEach((col, i) => {
                obj[col] = row[i];
            });
            return obj as T;
        });
    }

    private async executeDirect(sql: string, params: unknown[] = [], options?: { bootstrap?: boolean }): Promise<void> {
        await invoke('db_execute', { sql, params, bootstrap: options?.bootstrap ?? false });
    }

    private async transactionBatchDirect(statements: SqliteBatchStatement[], options?: { bootstrap?: boolean }): Promise<void> {
        await invoke('db_transaction', {
            statements,
            bootstrap: options?.bootstrap ?? false,
        });
    }

    private createTransactionProxy(): SqlitePort {
        const proxy: SqlitePort = {
            query: <T = unknown>(sql: string, params?: unknown[], options?: SqliteQueryOptions) => this.queryDirect<T>(sql, params, options),
            all: <T = unknown>(sql: string, params?: unknown[], options?: SqliteQueryOptions) => this.queryDirect<T>(sql, params, options),
            execute: (sql: string, params?: unknown[], options?: { bootstrap?: boolean }) => this.executeDirect(sql, params, options),
            transaction: async <T>(callback: (tx: SqlitePort) => Promise<T>) => callback(proxy),
            transactionBatch: (statements: SqliteBatchStatement[], options?: { bootstrap?: boolean }) => this.transactionBatchDirect(statements, options),
        };
        return proxy;
    }

    async query<T = unknown>(sql: string, params: unknown[] = [], options?: SqliteQueryOptions): Promise<T[]> {
        return this.withLock(() => this.queryDirect<T>(sql, params, options));
    }

    async all<T = unknown>(sql: string, params: unknown[] = [], options?: SqliteQueryOptions): Promise<T[]> {
        return this.withLock(() => this.queryDirect<T>(sql, params, options));
    }

    async execute(sql: string, params: unknown[] = [], options?: { bootstrap?: boolean }): Promise<void> {
        await this.withLock(() => this.executeDirect(sql, params, options));
    }

    async transaction<T>(callback: (tx: SqlitePort) => Promise<T>): Promise<T> {
        if (TauriSqliteAdapter.activeTransaction) {
            return callback(TauriSqliteAdapter.activeTransaction);
        }

        return this.withLock(async () => {
            const tx = this.createTransactionProxy();
            TauriSqliteAdapter.activeTransaction = tx;
            try {
                await this.executeDirect('BEGIN TRANSACTION');
                const result = await callback(tx);
                await this.executeDirect('COMMIT');
                return result;
            } catch (error) {
                await this.executeDirect('ROLLBACK');
                throw error;
            } finally {
                TauriSqliteAdapter.activeTransaction = null;
            }
        });
    }

    async transactionBatch(statements: SqliteBatchStatement[], options?: { bootstrap?: boolean }): Promise<void> {
        await this.withLock(() => this.transactionBatchDirect(statements, options));
    }
}
