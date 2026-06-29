import { describe, expect, it } from 'vitest';
import { ViewRegistry } from '../../../../domain/view/ViewRegistry';
import { SqliteViewRegistryRepository } from '../SqliteViewRegistryRepository';
import type { SqlitePort } from '@/src/application/ports/SqlitePort';

describe('SqliteViewRegistryRepository', () => {
    it('lê e salva em registro_visualizacoes com colunas canônicas', async () => {
        const queries: string[] = [];
        const executes: string[] = [];
        const db = {
            query: async (sql: string, _params: unknown[] = []) => {
                queries.push(sql);
                if (sql.includes('SELECT id FROM registro_visualizacoes')) return [];
                return [{
                    id: 'dash-1',
                    titulo: 'Dashboard',
                    perfis: '["admin"]',
                    layout: 'grid-2',
                    widgets: '[]',
                    module_type: 'inspecao',
                    ativo: 1,
                    criado_em: null,
                    atualizado_em: null,
                }];
            },
            execute: async (sql: string, _params: unknown[] = []) => { executes.push(sql); },
            all: async () => [],
            transaction: async <T>(cb: (tx: SqlitePort) => Promise<T>) => cb(db as unknown as SqlitePort),
        } as unknown as SqlitePort;

        const repo = new SqliteViewRegistryRepository(db);
        const dashboard = await repo.findById('dash-1');
        await repo.save(ViewRegistry.fromProps({
            id: 'dash-2',
            titulo: 'Novo',
            perfis: ['admin'],
            layout: 'grid-2',
            widgets: [],
            moduleType: 'inspecao',
            userId: null,
            isTemplate: true,
            ativo: true,
        }));

        expect(dashboard?.moduleType).toBe('inspecao');
        expect(queries.join('\n')).toContain('FROM registro_visualizacoes');
        expect(queries.join('\n')).not.toContain('view_registry');
        expect(executes.join('\n')).toContain('INSERT INTO registro_visualizacoes');
        expect(executes.join('\n')).toContain('tipo_modulo');
    });
});
