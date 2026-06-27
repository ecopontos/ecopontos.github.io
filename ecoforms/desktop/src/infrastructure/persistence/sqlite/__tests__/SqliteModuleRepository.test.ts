import { describe, expect, it } from 'vitest';
import { SqliteModuleRepository } from '../SqliteModuleRepository';
import type { ModuleRegistry } from '@/src/domain/module/ModuleRegistry';
import type { ModulePermissionConfig } from '@/src/domain/module/ModuleRegistry';
import type { SqlitePort } from '@/src/application/ports/SqlitePort';

function makeModule(overrides: Partial<ModuleRegistry> = {}): ModuleRegistry {
    return {
        id: 'mod-1',
        slug: 'fiscalizacao',
        name: 'Fiscalização',
        description: null,
        entity_type: 'fiscalizacao',
        icon: null,
        color: null,
        prefix: '/fiscal',
        ordem: 1,
        status: 'draft',
        version: 1,
        config_version: 1,
        config: {},
        suite_config: null,
        criado_em: '2026-01-01T00:00:00.000Z',
        atualizado_em: '2026-01-01T00:00:00.000Z',
        publicado_em: null,
        ...overrides,
    };
}

describe('SqliteModuleRepository — hardening de escrita', () => {
    it('save() faz UPSERT atômico (sem SELECT prévio, único execute)', async () => {
        const executes: string[] = [];
        const queries: string[] = [];
        const db = {
            query: async (sql: string) => { queries.push(sql); return []; },
            execute: async (sql: string) => { executes.push(sql); },
            all: async () => [],
            transaction: async <T>(cb: () => Promise<T>) => cb(),
        } as unknown as SqlitePort;

        const repo = new SqliteModuleRepository(db);
        await repo.save(makeModule());

        // nenhum SELECT de existência (race TOCTOU removido)
        expect(queries.join('\n')).not.toContain('SELECT id FROM registro_modulos');
        // único execute, com UPSERT
        expect(executes).toHaveLength(1);
        const sql = executes[0];
        expect(sql).toContain('INSERT INTO registro_modulos');
        expect(sql).toContain('config_version');
        expect(sql).toContain('ON CONFLICT(id) DO UPDATE');
        expect(sql).toContain('criado_em = registro_modulos.criado_em');
    });

    it('save() respeita criado_em do domínio no INSERT', async () => {
        const executes: string[] = [];
        let boundCriadoEm: unknown = undefined;
        const db = {
            query: async () => [],
            execute: async (sql: string, params: unknown[] = []) => {
                executes.push(sql);
                // params na ordem do VALUES: ..., config_version, criado_em (COALESCE), publicado_em
                boundCriadoEm = params[14];
            },
            all: async () => [],
            transaction: async <T>(cb: () => Promise<T>) => cb(),
        } as unknown as SqlitePort;

        const repo = new SqliteModuleRepository(db);
        await repo.save(makeModule({ criado_em: '2025-12-31T10:00:00.000Z', config_version: 7 }));

        expect(executes[0]).toContain('COALESCE(?, datetime(\'now\'))');
        expect(boundCriadoEm).toBe('2025-12-31T10:00:00.000Z');
    });

    it('setPermissions() envolve DELETE + INSERTs em transação', async () => {
        const executes: string[] = [];
        let txCalls = 0;
        let executedInsideTx = 0;
        let inTx = false;
        const db = {
            query: async () => [],
            execute: async (sql: string) => {
                executes.push(sql);
                if (inTx) executedInsideTx++;
            },
            all: async () => [],
            transaction: async <T>(cb: () => Promise<T>) => {
                txCalls++;
                inTx = true;
                try { return await cb(); } finally { inTx = false; }
            },
        } as unknown as SqlitePort;

        const perms: ModulePermissionConfig[] = [
            { profile: 'admin', can_view: true, can_create: true, can_edit: true, can_approve: true, can_delete: true },
            { profile: 'operador', can_view: true, can_create: false, can_edit: false, can_approve: false, can_delete: false },
        ];

        const repo = new SqliteModuleRepository(db);
        await repo.setPermissions('mod-1', perms);

        expect(txCalls).toBe(1);
        // 1 DELETE + 2 INSERTs, todos dentro da transação
        expect(executedInsideTx).toBe(3);
        expect(executes.some(s => s.includes('DELETE FROM permissoes_modulos'))).toBe(true);
        expect(executes.filter(s => s.includes('INSERT INTO permissoes_modulos'))).toHaveLength(2);
    });
    it('loadRuntimeDto() retorna null quando o perfil não tem can_view', async () => {
        const db = {
            query: async (sql: string) => {
                if (sql.includes('FROM registro_modulos')) {
                    return [{
                        id: 'mod-1',
                        slug: 'fiscalizacao',
                        nome: 'Fiscalização',
                        descricao: null,
                        tipo_entidade: 'fiscalizacao',
                        icon: null,
                        color: null,
                        prefix: '/fiscal',
                        ordem: 1,
                        status: 'draft',
                        versao: 1,
                        configuracao: '{}',
                        config_suite: null,
                        criado_em: '2026-01-01T00:00:00.000Z',
                        atualizado_em: '2026-01-01T00:00:00.000Z',
                        publicado_em: null,
                    }];
                }
                if (sql.includes('FROM permissoes_modulos')) {
                    return [{ profile: 'operador', can_view: 0, can_create: 0, can_edit: 0, can_approve: 0, can_delete: 0 }];
                }
                return [];
            },
            execute: async () => {},
            all: async () => [],
            transaction: async <T>(cb: () => Promise<T>) => cb(),
        } as unknown as SqlitePort;

        const repo = new SqliteModuleRepository(db);
        await expect(repo.loadRuntimeDto('fiscalizacao', 'operador')).resolves.toBeNull();
    });

    it('loadRuntimeDto() permite admin mesmo sem permissão cadastrada', async () => {
        const db = {
            query: async (sql: string) => {
                if (sql.includes('FROM registro_modulos')) {
                    return [{
                        id: 'mod-1',
                        slug: 'fiscalizacao',
                        nome: 'Fiscalização',
                        descricao: null,
                        tipo_entidade: 'fiscalizacao',
                        icon: null,
                        color: null,
                        prefix: '/fiscal',
                        ordem: 1,
                        status: 'draft',
                        versao: 1,
                        configuracao: '{}',
                        config_suite: null,
                        criado_em: '2026-01-01T00:00:00.000Z',
                        atualizado_em: '2026-01-01T00:00:00.000Z',
                        publicado_em: null,
                    }];
                }
                if (sql.includes('FROM permissoes_modulos')) {
                    return [];
                }
                return [];
            },
            execute: async () => {},
            all: async () => [],
            transaction: async <T>(cb: () => Promise<T>) => cb(),
        } as unknown as SqlitePort;

        const repo = new SqliteModuleRepository(db);
        const dto = await repo.loadRuntimeDto('fiscalizacao', 'admin');

        expect(dto).not.toBeNull();
        expect(dto!.permissions).toEqual({
            can_view: true,
            can_create: true,
            can_edit: true,
            can_approve: true,
            can_delete: true,
        });
        expect(dto!.forms).toEqual([]);
        expect(dto!.data_catalogs).toEqual([]);
        expect(dto!.views).toEqual([]);
        expect(dto!.decisions).toEqual([]);
    });

    it('loadRuntimeDto() hidrata definitions de views e decisions do registro', async () => {
        const db = {
            query: async (sql: string) => {
                if (sql.includes('FROM registro_modulos')) {
                    return [{
                        id: 'mod-1',
                        slug: 'fiscalizacao',
                        nome: 'Fiscalização',
                        descricao: null,
                        tipo_entidade: 'fiscalizacao',
                        icon: null,
                        color: null,
                        prefix: '/fiscal',
                        ordem: 1,
                        status: 'draft',
                        versao: 1,
                        configuracao: JSON.stringify({
                            views: [{ view_id: 'view-1', context: 'dashboard', order: 2 }],
                            decisions: [{ decision_id: 'dec-1' }],
                        }),
                        config_suite: null,
                        criado_em: '2026-01-01T00:00:00.000Z',
                        atualizado_em: '2026-01-01T00:00:00.000Z',
                        publicado_em: null,
                    }];
                }
                if (sql.includes('FROM permissoes_modulos')) {
                    return [{ profile: 'operador', can_view: 1, can_create: 0, can_edit: 0, can_approve: 0, can_delete: 0 }];
                }
                if (sql.includes('FROM registro_visualizacoes')) {
                    return [{
                        id: 'view-1',
                        titulo: 'Visão',
                        perfis: JSON.stringify(['operador']),
                        layout: 'grid-2',
                        widgets: JSON.stringify([{ type: 'card' }]),
                        module_type: 'fiscalizacao',
                        user_id: null,
                        is_template: 0,
                        ativo: 1,
                        criado_em: '2026-01-01T00:00:00.000Z',
                        atualizado_em: '2026-01-01T00:00:00.000Z',
                    }];
                }
                if (sql.includes('FROM registro_decisoes')) {
                    return [{
                        id: 'dec-1',
                        target_type: 'fiscalizacao',
                        action: 'aprovar',
                        perfis: JSON.stringify(['operador']),
                        enabled_when: JSON.stringify([{ field: 'status', op: '=', value: 'aberto' }]),
                        steps: JSON.stringify([{ type: 'notify' }]),
                        params: JSON.stringify({ foo: 'bar' }),
                        consequence_type: 'terminal',
                        consequence_pattern: null,
                        consequence_config: JSON.stringify({ success: true }),
                        ativo: 1,
                        criado_em: '2026-01-01T00:00:00.000Z',
                        atualizado_em: '2026-01-01T00:00:00.000Z',
                    }];
                }
                return [];
            },
            execute: async () => {},
            all: async () => [],
            transaction: async <T>(cb: () => Promise<T>) => cb(),
        } as unknown as SqlitePort;

        const repo = new SqliteModuleRepository(db);
        const dto = await repo.loadRuntimeDto('fiscalizacao', 'operador');

        expect(dto).not.toBeNull();
        expect(dto!.views).toHaveLength(1);
        expect(dto!.views[0]).toMatchObject({
            view_id: 'view-1',
            context: 'dashboard',
            order: 2,
        });
        expect(dto!.views[0].definition).toMatchObject({
            id: 'view-1',
            titulo: 'Visão',
            layout: 'grid-2',
            module_type: 'fiscalizacao',
            ativo: true,
        });
        expect(dto!.decisions).toHaveLength(1);
        expect(dto!.decisions[0]).toMatchObject({
            decision_id: 'dec-1',
        });
        expect(dto!.decisions[0].definition).toMatchObject({
            id: 'dec-1',
            target_type: 'fiscalizacao',
            action: 'aprovar',
            consequence_type: 'terminal',
            ativo: true,
        });
    });

    it('loadRuntimeDto() carrega data catalogs em batch com colunas explicitas', async () => {
        const queries: Array<{ sql: string; params?: unknown[] }> = [];
        const db = {
            query: async (sql: string, params?: unknown[]) => {
                queries.push({ sql, params });
                if (sql.includes('FROM registro_modulos')) {
                    return [{
                        id: 'mod-1',
                        slug: 'fiscalizacao',
                        nome: 'Fiscalizacao',
                        descricao: null,
                        tipo_entidade: 'fiscalizacao',
                        icon: null,
                        color: null,
                        prefix: '/fiscal',
                        ordem: 1,
                        status: 'draft',
                        versao: 1,
                        config_version: 1,
                        configuracao: JSON.stringify({
                            data_catalogs: [
                                { catalog_id: 'tipo_residuo', required: true },
                                { catalog_id: 'setor', required: false },
                            ],
                        }),
                        config_suite: null,
                        criado_em: '2026-01-01T00:00:00.000Z',
                        atualizado_em: '2026-01-01T00:00:00.000Z',
                        publicado_em: null,
                    }];
                }
                if (sql.includes('FROM permissoes_modulos')) {
                    return [{ profile: 'operador', can_view: 1, can_create: 0, can_edit: 0, can_approve: 0, can_delete: 0 }];
                }
                if (sql.includes('FROM registro_dados')) {
                    return [
                        { id: 'dado-1', tipo: 'tipo_residuo', chave: 'plastico', conteudo: '{"nome":"Plastico"}', versao: 1, criado_em: '2026-01-01', atualizado_em: '2026-01-01' },
                        { id: 'dado-2', tipo: 'setor', chave: 'centro', conteudo: '{"nome":"Centro"}', versao: 1, criado_em: '2026-01-01', atualizado_em: '2026-01-01' },
                    ];
                }
                return [];
            },
            execute: async () => {},
            all: async () => [],
            transaction: async <T>(cb: () => Promise<T>) => cb(),
        } as unknown as SqlitePort;

        const repo = new SqliteModuleRepository(db);
        const dto = await repo.loadRuntimeDto('fiscalizacao', 'operador');

        const dataQueries = queries.filter(q => q.sql.includes('FROM registro_dados'));
        expect(dataQueries).toHaveLength(1);
        expect(dataQueries[0].sql).toContain('tipo IN (?,?)');
        expect(dataQueries[0].sql).not.toContain('SELECT *');
        expect(dataQueries[0].params).toEqual(['tipo_residuo', 'setor']);
        expect(dto!.data_catalogs).toEqual([
            { catalog_id: 'tipo_residuo', required: true, items: [expect.objectContaining({ id: 'dado-1', tipo: 'tipo_residuo' })] },
            { catalog_id: 'setor', required: false, items: [expect.objectContaining({ id: 'dado-2', tipo: 'setor' })] },
        ]);
    });

});
