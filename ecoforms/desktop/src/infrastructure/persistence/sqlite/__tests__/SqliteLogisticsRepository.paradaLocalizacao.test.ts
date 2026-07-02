import { describe, expect, it } from 'vitest';
import { SqliteLogisticsRepository } from '../SqliteLogisticsRepository';
import type { SqlitePort } from '@/src/application/ports/SqlitePort';

function makeDb(overrides: { query?: (sql: string, params: unknown[]) => unknown[] } = {}) {
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
        transaction: async <T,>(cb: (tx: SqlitePort) => Promise<T>) => cb(db as unknown as SqlitePort),
    } as unknown as SqlitePort;
    return { db, queries, executes };
}

describe('SqliteLogisticsRepository — override de localização por parada', () => {
    it('findClientesByRoteiro seleciona imovel_id e ponto_operacional_id da parada', async () => {
        const { db, queries } = makeDb({
            query: () => [{
                id: 'rc-1', roteiroId: 'rot-1', clienteId: 'cli-1', ordem: 1,
                observacao: null, ativo: 1, criadoEm: '2026-01-01', clienteNome: 'Cliente 1',
                imovelId: 'ter-1', pontoOperacionalId: 'po-1',
            }],
        });
        const repo = new SqliteLogisticsRepository(db);

        const rows = await repo.findClientesByRoteiro('rot-1');

        expect(queries[0].sql).toContain('rc.imovel_id AS imovelId');
        expect(queries[0].sql).toContain('rc.ponto_operacional_id AS pontoOperacionalId');
        expect(rows[0].imovelId).toBe('ter-1');
        expect(rows[0].pontoOperacionalId).toBe('po-1');
    });

    it('updateParadaLocalizacao grava imovel_id e ponto_operacional_id da parada', async () => {
        const { db, executes } = makeDb();
        const repo = new SqliteLogisticsRepository(db);

        await repo.updateParadaLocalizacao('rot-1', 'cli-1', { imovelId: 'ter-2', pontoOperacionalId: 'po-2' });

        expect(executes[0].sql).toContain('UPDATE roteiro_clientes SET imovel_id = ?, ponto_operacional_id = ?');
        expect(executes[0].params).toEqual(['ter-2', 'po-2', 'rot-1', 'cli-1']);
    });

    it('updateParadaLocalizacao aceita null nos dois campos para remover o override', async () => {
        const { db, executes } = makeDb();
        const repo = new SqliteLogisticsRepository(db);

        await repo.updateParadaLocalizacao('rot-1', 'cli-1', { imovelId: null, pontoOperacionalId: null });

        expect(executes[0].params).toEqual([null, null, 'rot-1', 'cli-1']);
    });
});
