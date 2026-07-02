import { describe, expect, it } from 'vitest';
import { SqliteClienteRepository } from '../SqliteClienteRepository';
import type { SqlitePort } from '@/src/application/ports/SqlitePort';

function makeDb(overrides: {
    query?: (sql: string, params: unknown[]) => unknown[];
} = {}) {
    const queries: { sql: string; params: unknown[] }[] = [];
    const executes: { sql: string; params: unknown[] }[] = [];
    const db = {
        query: async (sql: string, params: unknown[] = []) => {
            queries.push({ sql, params });
            return overrides.query?.(sql, params) ?? [];
        },
        execute: async (sql: string, params: unknown[] = []) => {
            executes.push({ sql, params });
        },
        all: async () => [],
        transaction: async <T>(cb: (tx: SqlitePort) => Promise<T>) => cb(db as unknown as SqlitePort),
    } as unknown as SqlitePort;
    return { db, queries, executes };
}

describe('SqliteClienteRepository.updateVinculoImovel', () => {
    it('limpa clientes.terreno_id quando o vínculo principal é desmarcado e não sobra outro principal', async () => {
        const { db, executes } = makeDb({
            query: (sql) => {
                if (sql.includes('SELECT cliente_id, imovel_id FROM cliente_imovel_vinculos WHERE id')) {
                    return [{ cliente_id: 'cli-1', imovel_id: 'ter-1' }];
                }
                if (sql.includes('SELECT COUNT(*) as cnt FROM cliente_imovel_vinculos WHERE cliente_id = ? AND principal = 1')) {
                    return [{ cnt: 0 }];
                }
                return [];
            },
        });
        const repo = new SqliteClienteRepository(db);

        await repo.updateVinculoImovel('vinc-1', { principal: false });

        const clearLegacy = executes.find((e) =>
            e.sql.includes('UPDATE clientes SET terreno_id = NULL') && e.params.includes('cli-1')
        );
        expect(clearLegacy).toBeDefined();
    });

    it('mantém clientes.terreno_id quando ainda existe outro vínculo principal após desmarcar este', async () => {
        const { db, executes } = makeDb({
            query: (sql) => {
                if (sql.includes('SELECT cliente_id, imovel_id FROM cliente_imovel_vinculos WHERE id')) {
                    return [{ cliente_id: 'cli-1', imovel_id: 'ter-1' }];
                }
                if (sql.includes('SELECT COUNT(*) as cnt FROM cliente_imovel_vinculos WHERE cliente_id = ? AND principal = 1')) {
                    return [{ cnt: 1 }];
                }
                return [];
            },
        });
        const repo = new SqliteClienteRepository(db);

        await repo.updateVinculoImovel('vinc-1', { principal: false });

        const clearLegacy = executes.find((e) => e.sql.includes('UPDATE clientes SET terreno_id = NULL'));
        expect(clearLegacy).toBeUndefined();
    });
});
