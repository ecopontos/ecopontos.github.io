import { describe, it, expect, beforeEach } from 'vitest';
import { ModuleVisualView } from '../../../domain/visual/ModuleVisualView';
import { resolveBind, type ViewContext } from '../resolveBind';
import { CreateViewUseCase, UpdateViewUseCase, DeleteViewUseCase, SetDefaultViewUseCase, CopyViewToPersonalUseCase, SyncPersonalViewUseCase } from '../VisualViewUseCases';
import { GetModuleVisuaisUseCase } from '../GetModuleVisuaisUseCase';
import { VisualQueryCache } from '../VisualQueryCache';
import { InMemoryModuleVisualViewRepository } from '../../../test/fakes/InMemoryModuleVisualViewRepository';
import type { SqlitePort } from '../../ports/SqlitePort';

// ── ModuleVisualView domain entity ──────────────────────────────────

describe('ModuleVisualView', () => {
    const now = '2026-05-08T12:00:00.000Z';

    const validRow: Record<string, unknown> = {
        id: 'view-1',
        module_id: 'mod-1',
        visual_type: 'table',
        name: 'Minhas Inspeções',
        config: JSON.stringify({ filters: [{ field: 'status', op: '=', value: 'ativo' }] }),
        is_default: 1,
        user_id: null,
        parent_view_id: null,
        sync_status: 'synced',
        position: 0,
        criado_em: now,
        atualizado_em: now,
    };

    it('fromRow deve criar entidade com dados corretos', () => {
        const view = ModuleVisualView.fromRow(validRow);
        expect(view.id).toBe('view-1');
        expect(view.module_id).toBe('mod-1');
        expect(view.visual_type).toBe('table');
        expect(view.name).toBe('Minhas Inspeções');
        expect(view.is_default).toBe(true);
        expect(view.user_id).toBeNull();
        expect(view.isGlobal()).toBe(true);
        expect(view.isPersonal()).toBe(false);
        expect(view.sync_status).toBe('synced');
        expect(view.position).toBe(0);
    });

    it('fromRow com is_default = 0 deve gerar is_default = false', () => {
        const view = ModuleVisualView.fromRow({ ...validRow, is_default: 0 });
        expect(view.is_default).toBe(false);
    });

    it('fromRow com user_id preenchido deve marcar como pessoal', () => {
        const view = ModuleVisualView.fromRow({ ...validRow, user_id: 'user-42' });
        expect(view.isGlobal()).toBe(false);
        expect(view.isPersonal()).toBe(true);
        expect(view.user_id).toBe('user-42');
    });

    it('toRow deve serializar corretamente', () => {
        const view = ModuleVisualView.fromRow(validRow);
        const row = view.toRow();
        expect(row.id).toBe('view-1');
        expect(row.module_id).toBe('mod-1');
        expect(row.visual_type).toBe('table');
        expect(row.is_default).toBe(1);
        expect(row.user_id).toBeNull();
    });

    it('markOutdated deve alterar sync_status para outdated', () => {
        const view = ModuleVisualView.fromRow(validRow);
        const outdated = view.markOutdated();
        expect(outdated.sync_status).toBe('outdated');
        expect(view.sync_status).toBe('synced');
    });

    it('updateConfig deve atualizar config', () => {
        const view = ModuleVisualView.fromRow(validRow);
        const newConfig = JSON.stringify({ filters: [] });
        const updated = view.updateConfig(newConfig);
        expect(updated.config).toBe(newConfig);
    });

    it('fromProps deve criar entidade com props', () => {
        const view = ModuleVisualView.fromProps({
            id: 'custom-id',
            module_id: 'mod-2',
            visual_type: 'chart',
            name: 'Gráfico',
            config: '{}',
            is_default: true,
            user_id: null,
            parent_view_id: null,
            sync_status: 'synced',
            position: 1,
            criado_em: now,
            atualizado_em: now,
        });
        expect(view.id).toBe('custom-id');
        expect(view.visual_type).toBe('chart');
    });
});

// ── resolveBind ──────────────────────────────────────────────────────

describe('resolveBind', () => {
    const ctx: ViewContext = {
        userId: 'user-1',
        userProfile: 'gerente',
        userSector: 'setor-a',
    };

    it('deve retornar valor literal se não começar com @', () => {
        expect(resolveBind('42', ctx)).toBe('42');
        expect(resolveBind('ativo', ctx)).toBe('ativo');
    });

    it('deve resolver @user.id', () => {
        expect(resolveBind('@user.id', ctx)).toBe('user-1');
    });

    it('deve resolver @user.perfil', () => {
        expect(resolveBind('@user.perfil', ctx)).toBe('gerente');
    });

    it('deve resolver @user.setor', () => {
        expect(resolveBind('@user.setor', ctx)).toBe('setor-a');
    });

    it('deve resolver @today como data ISO', () => {
        const result = resolveBind('@today', ctx) as string;
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('deve resolver @now como timestamp ISO', () => {
        const result = resolveBind('@now', ctx) as string;
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('deve resolver @month.start como primeiro dia do mês', () => {
        const result = resolveBind('@month.start', ctx) as string;
        expect(result).toMatch(/^\d{4}-\d{2}-01$/);
    });

    it('deve resolver @month.end como último dia do mês', () => {
        const result = resolveBind('@month.end', ctx) as string;
        const day = parseInt(result.slice(-2), 10);
        expect(day).toBeGreaterThanOrEqual(28);
    });

    it('deve retornar null para bind desconhecido', () => {
        expect(resolveBind('@unknown.var', ctx)).toBeNull();
    });

    it('deve retornar null para user.id quando userId é null', () => {
        expect(resolveBind('@user.id', { userId: undefined as any, userProfile: '', userSector: null })).toBeNull();
    });
});

// ── VisualViewUseCases ──────────────────────────────────────────────

describe('CreateViewUseCase', () => {
    let repo: InMemoryModuleVisualViewRepository;
    let sut: CreateViewUseCase;

    beforeEach(() => {
        repo = new InMemoryModuleVisualViewRepository();
        sut = new CreateViewUseCase(repo);
    });

    it('deve criar uma view global', async () => {
        const view = await sut.execute('mod-1', 'table', 'Inspeções', { columns: ['status'] });
        expect(view.name).toBe('Inspeções');
        expect(view.visual_type).toBe('table');
        expect(view.isGlobal()).toBe(true);
        expect(view.id).toBeDefined();
    });

    it('deve criar uma view pessoal', async () => {
        const view = await sut.execute('mod-1', 'chart', 'Meu Gráfico', { chart_type: 'pie', category_field: 'status' }, 'user-1');
        expect(view.isPersonal()).toBe(true);
        expect(view.user_id).toBe('user-1');
    });

    it('deve rejeitar config inválida para chart', async () => {
        await expect(sut.execute('mod-1', 'chart', 'Inválido', {}))
            .rejects.toThrow('chart_type');
    });

    it('deve rejeitar config inválida para kanban', async () => {
        await expect(sut.execute('mod-1', 'kanban', 'Inválido', {}))
            .rejects.toThrow('status_field');
    });

    it('deve salvar view no repositório', async () => {
        const view = await sut.execute('mod-1', 'table', 'Salva', {});
        const saved = await repo.findById(view.id);
        expect(saved).not.toBeNull();
        expect(saved!.name).toBe('Salva');
    });
});

describe('UpdateViewUseCase', () => {
    let repo: InMemoryModuleVisualViewRepository;
    let sut: UpdateViewUseCase;

    beforeEach(() => {
        repo = new InMemoryModuleVisualViewRepository();
        sut = new UpdateViewUseCase(repo);
    });

    it('deve atualizar config de uma view', async () => {
        const create = new CreateViewUseCase(repo);
        const view = await create.execute('mod-1', 'table', 'Original', { columns: ['a'] });

        const updated = await sut.execute(view.id, { columns: ['a', 'b'] });
        const parsed = JSON.parse(updated.config);
        expect(parsed.columns).toEqual(['a', 'b']);
    });

    it('deve lançar erro se view não existe', async () => {
        await expect(sut.execute('inexistente', {})).rejects.toThrow('not found');
    });

    it('deve lançar erro se user_id não corresponde', async () => {
        const create = new CreateViewUseCase(repo);
        const view = await create.execute('mod-1', 'table', 'Pessoal', {}, 'user-1');

        await expect(sut.execute(view.id, {}, 'user-2')).rejects.toThrow('another user');
    });
});

describe('DeleteViewUseCase', () => {
    let repo: InMemoryModuleVisualViewRepository;
    let sut: DeleteViewUseCase;

    beforeEach(() => {
        repo = new InMemoryModuleVisualViewRepository();
        sut = new DeleteViewUseCase(repo);
    });

    it('deve deletar view existente', async () => {
        const create = new CreateViewUseCase(repo);
        const view = await create.execute('mod-1', 'table', 'Del', {});

        await sut.execute(view.id);
        expect(await repo.findById(view.id)).toBeNull();
    });

    it('deve lançar erro se view não existe', async () => {
        await expect(sut.execute('inexistente')).rejects.toThrow('not found');
    });
});

describe('SetDefaultViewUseCase', () => {
    let repo: InMemoryModuleVisualViewRepository;
    let sut: SetDefaultViewUseCase;

    beforeEach(async () => {
        repo = new InMemoryModuleVisualViewRepository();
        sut = new SetDefaultViewUseCase(repo);
        const create = new CreateViewUseCase(repo);
        await create.execute('mod-1', 'table', 'V1', {});
        await create.execute('mod-1', 'table', 'V2', {});
    });

    it('deve definir view como default do visual', async () => {
        const views = await repo.findByModuleIdAndType('mod-1', 'table');
        const target = views[1];

        await sut.execute(target.id);
        const updated = await repo.findById(target.id);
        expect(updated!.is_default).toBe(true);
    });
});

describe('CopyViewToPersonalUseCase', () => {
    let repo: InMemoryModuleVisualViewRepository;
    let sut: CopyViewToPersonalUseCase;

    beforeEach(() => {
        repo = new InMemoryModuleVisualViewRepository();
        sut = new CopyViewToPersonalUseCase(repo);
    });

    it('deve criar cópia pessoal de view global', async () => {
        const create = new CreateViewUseCase(repo);
        const global = await create.execute('mod-1', 'table', 'Global', {});

        const personal = await sut.execute(global.id, 'user-42');
        expect(personal.user_id).toBe('user-42');
        expect(personal.parent_view_id).toBe(global.id);
        expect(personal.name).toBe('Global');
    });

    it('deve lançar erro se view não é global', async () => {
        const create = new CreateViewUseCase(repo);
        const personal = await create.execute('mod-1', 'table', 'Pessoal', {}, 'user-1');

        await expect(sut.execute(personal.id, 'user-2')).rejects.toThrow('not found');
    });
});

describe('SyncPersonalViewUseCase', () => {
    let repo: InMemoryModuleVisualViewRepository;
    let sut: SyncPersonalViewUseCase;

    beforeEach(() => {
        repo = new InMemoryModuleVisualViewRepository();
        sut = new SyncPersonalViewUseCase(repo);
    });

    it('deve marcar cópias pessoais como outdated quando global muda', async () => {
        const create = new CreateViewUseCase(repo);
        const global = await create.execute('mod-1', 'table', 'Global', {});
        const copy = new CopyViewToPersonalUseCase(repo);
        await copy.execute(global.id, 'user-1');
        await copy.execute(global.id, 'user-2');

        await sut.execute(global.id);
        const personalViews = await repo.findByParentId(global.id);
        expect(personalViews.every(v => v.sync_status === 'outdated')).toBe(true);
    });

    it('deve lançar erro se view não é global', async () => {
        const create = new CreateViewUseCase(repo);
        const personal = await create.execute('mod-1', 'table', 'Pessoal', {}, 'user-1');

        await expect(sut.execute(personal.id)).rejects.toThrow('not found');
    });
});

// ── GetModuleVisuaisUseCase ─────────────────────────────────────────

describe('GetModuleVisuaisUseCase', () => {
    function createMockSqlite(modules: Record<string, unknown>[]): SqlitePort {
        return {
            query: async (_sql: string, _params?: unknown[]) => {
                if (_sql.includes('module_registry')) return modules as any;
                if (_sql.includes('data_registry')) return [
                    { id: 'r1', tipo: 'inspecao', conteudo: '{"status":"ativo"}' },
                    { id: 'r2', tipo: 'inspecao', conteudo: '{"status":"inativo"}' },
                ] as any;
                return [];
            },
            all: async (_sql: string, _params?: unknown[]) => {
                return [
                    { id: 'r1', tipo: 'inspecao', conteudo: '{"status":"ativo"}' },
                    { id: 'r2', tipo: 'inspecao', conteudo: '{"status":"inativo"}' },
                ] as any;
            },
            execute: async () => {},
            transaction: async <T>(cb: () => Promise<T>) => cb(),
        };
    }

    it('deve retornar null se módulo não existe', async () => {
        const mockDb = createMockSqlite([]);
        const repo = new InMemoryModuleVisualViewRepository();
        const cache = new VisualQueryCache();
        const sut = new GetModuleVisuaisUseCase(mockDb, repo, cache);

        const result = await sut.execute('inexistente', 'user-1', 'admin');
        expect(result).toBeNull();
    });

    it('deve retornar visuais configurados no módulo com permissão', async () => {
        const mockDb = createMockSqlite([{
            id: 'mod-1',
            slug: 'inspecoes',
            name: 'Inspeções',
            entity_type: 'inspecao',
            config: JSON.stringify({
                entity_type: 'inspecao',
                visuais: [
                    { type: 'table', title: 'Tabela', position: { w: 12 }, permissions: { can_view: ['admin', 'gerente'] } },
                    { type: 'chart', title: 'Gráfico', position: { w: 6 }, permissions: { can_view: ['admin'] } },
                ],
            }),
        }]);

        const repo = new InMemoryModuleVisualViewRepository();
        const create = new CreateViewUseCase(repo);
        await create.execute('mod-1', 'table', 'Minha View', { columns: ['status'] });

        const cache = new VisualQueryCache();
        const sut = new GetModuleVisuaisUseCase(mockDb, repo, cache);

        const result = await sut.execute('inspecoes', 'user-1', 'admin');

        expect(result).not.toBeNull();
        expect(result!.slug).toBe('inspecoes');
        expect(result!.visuais.length).toBe(2);
        expect(result!.visuais[0].visual_type).toBe('table');
        expect(result!.visuais[0].name).toBe('Tabela');
        expect(result!.visuais[1].visual_type).toBe('chart');
    });

    it('deve filtrar visuais por perfil', async () => {
        const mockDb = createMockSqlite([{
            id: 'mod-1',
            slug: 'inspecoes',
            name: 'Inspeções',
            entity_type: 'inspecao',
            config: JSON.stringify({
                entity_type: 'inspecao',
                visuais: [
                    { type: 'table', title: 'Admin Table', position: { w: 12 }, permissions: { can_view: ['admin'] } },
                ],
            }),
        }]);

        const repo = new InMemoryModuleVisualViewRepository();
        const cache = new VisualQueryCache();
        const sut = new GetModuleVisuaisUseCase(mockDb, repo, cache);

        const result = await sut.execute('inspecoes', 'user-1', 'campo');
        expect(result!.visuais.length).toBe(0);
    });

    it('deve buscar dados para view default', async () => {
        const mockDb = createMockSqlite([{
            id: 'mod-1',
            slug: 'inspecoes',
            name: 'Inspeções',
            entity_type: 'inspecao',
            config: JSON.stringify({
                entity_type: 'inspecao',
                visuais: [
                    { type: 'table', title: 'Tabela', position: { w: 12 }, permissions: { can_view: ['admin'] } },
                ],
            }),
        }]);

        const repo = new InMemoryModuleVisualViewRepository();
        const create = new CreateViewUseCase(repo);
        const table = await create.execute('mod-1', 'table', 'Padrão', { columns: ['status'] });
        await new SetDefaultViewUseCase(repo).execute(table.id);

        const cache = new VisualQueryCache();
        const sut = new GetModuleVisuaisUseCase(mockDb, repo, cache);

        const result = await sut.execute('inspecoes', 'user-1', 'admin');
        expect(result!.visuais[0].views.length).toBe(1);
        expect(result!.visuais[0].views[0].name).toBe('Padrão');
        expect(result!.visuais[0].data).toBeDefined();
        expect(result!.visuais[0].data!.length).toBe(2);
    });

    it('deve filtrar visuais por dashboard_id', async () => {
        let capturedQuery = '';
        const mockDb: SqlitePort = {
            query: async (_sql: string) => {
                capturedQuery = _sql;
                if (_sql.includes('registro_visualizacoes')) return [{ widgets: JSON.stringify([{ source: 'module_visual', visual_type: 'table' }]) }] as any;
                if (_sql.includes('module_registry')) return [{
                    id: 'mod-1', slug: 'inspecoes', name: 'Inspeções', entity_type: 'inspecao',
                    status: 'published',
                    config: JSON.stringify({
                        entity_type: 'inspecao',
                        visuais: [
                            { type: 'table', title: 'Tabela', position: { w: 12 }, permissions: { can_view: ['admin'] } },
                            { type: 'chart', title: 'Gráfico', position: { w: 6 }, permissions: { can_view: ['admin'] } },
                        ],
                    }),
                }] as any;
                return [] as any;
            },
            all: async () => [] as any,
            execute: async () => {},
            transaction: async <T>(cb: () => Promise<T>) => cb(),
        };

        const repo = new InMemoryModuleVisualViewRepository();
        const cache = new VisualQueryCache();
        const sut = new GetModuleVisuaisUseCase(mockDb, repo, cache);
        const result = await sut.execute('inspecoes', 'user-1', 'admin', undefined, 'dash-1');
        expect(capturedQuery).toContain('registro_visualizacoes');
        expect(result!.visuais.length).toBe(1);
    });
});
