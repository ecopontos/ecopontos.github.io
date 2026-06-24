import { useState } from 'react';
import { getContainerAsync } from '../../../infrastructure/container';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

/**
 * Adapter proxy que retorna imediatamente mas enfileira queries até que
 * `getContainerAsync()` (e portanto `db_connect`) esteja completo.
 * Elimina a condição de corrida sem quebrar a tipagem dos ~20 consumidores.
 */
class PendingSqliteAdapter implements SqlitePort {
    private real: SqlitePort | null = null;
    private readyPromise: Promise<void> | null = null;

    constructor() {
        this.readyPromise = getContainerAsync()
            .then((c) => {
                this.real = c.sqlite;
            })
            .catch((err) => {
                console.error('[PendingSqliteAdapter] init failed:', err);
                throw err;
            });
    }

    private async ensureReady(): Promise<SqlitePort> {
        if (this.real) return this.real;
        await this.readyPromise;
        if (!this.real) throw new Error('Database adapter not available');
        return this.real;
    }

    async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
        const adapter = await this.ensureReady();
        return adapter.query<T>(sql, params);
    }

    async all<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
        const adapter = await this.ensureReady();
        return adapter.all<T>(sql, params);
    }

    async execute(sql: string, params?: unknown[]): Promise<void> {
        const adapter = await this.ensureReady();
        return adapter.execute(sql, params);
    }

    async transaction<T>(callback: () => Promise<T>): Promise<T> {
        const adapter = await this.ensureReady();
        return adapter.transaction(callback);
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
