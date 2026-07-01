import { useState } from 'react';
import { getContainerAsync } from '../utils/useContainer';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

/**
 * Adapter proxy que retorna imediatamente mas carrega o container SQLite sob demanda.
 * Evita corrida de inicialização sem acoplar os hooks ao runtime Tauri durante a montagem.
 */
class PendingSqliteAdapter implements SqlitePort {
    private real: SqlitePort | null = null;
    private readyPromise: Promise<void> | null = null;

    private async ensureReady(): Promise<SqlitePort> {
        if (this.real) return this.real;
        if (!this.readyPromise) {
            this.readyPromise = getContainerAsync()
                .then((c) => {
                    this.real = c.sqlite;
                })
                .catch((err) => {
                    console.error('[PendingSqliteAdapter] init failed:', err);
                    throw err;
                });
        }
        await this.readyPromise;
        if (!this.real) throw new Error('Database adapter not available');
        return this.real;
    }

    async query<T = unknown>(sql: string, params?: unknown[], options?: { bootstrap?: boolean }): Promise<T[]> {
        const adapter = await this.ensureReady();
        return adapter.query<T>(sql, params, options);
    }

    async all<T = unknown>(sql: string, params?: unknown[], options?: { bootstrap?: boolean }): Promise<T[]> {
        const adapter = await this.ensureReady();
        return adapter.all<T>(sql, params, options);
    }

    async execute(sql: string, params?: unknown[], options?: { bootstrap?: boolean }): Promise<void> {
        const adapter = await this.ensureReady();
        return adapter.execute(sql, params, options);
    }

    async transaction<T>(callback: (tx: SqlitePort) => Promise<T>): Promise<T> {
        const adapter = await this.ensureReady();
        return adapter.transaction(callback);
    }

    async transactionBatch(statements: Array<{ sql: string; params?: unknown[] }>, options?: { bootstrap?: boolean }): Promise<void> {
        const adapter = await this.ensureReady();
        if (adapter.transactionBatch) {
            return adapter.transactionBatch(statements, options);
        }
        return adapter.transaction(async (tx) => {
            for (const statement of statements) {
                await tx.execute(statement.sql, statement.params, options);
            }
        });
    }
}

/**
 * Acesso direto ao SqlitePort para componentes/páginas que ainda fazem queries ad-hoc.
 * Retorna um adapter proxy que aguarda a inicialização do banco antes de executar queries.
 *
 * Preferir, sempre que possível, hooks de domínio (useTaskUseCases, useClientUseCases, etc).
 */
export function useSqlite(): SqlitePort {
    const [adapter] = useState<PendingSqliteAdapter>(() => new PendingSqliteAdapter());
    return adapter;
}
