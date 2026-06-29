import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LanPullService } from '../LanPullService';
import type { LanDomainSyncService } from '../LanDomainSyncService';
import type { SqlitePort } from '../../../application/ports/SqlitePort';
import type { LanIndex } from '../../storage/LanFileStorage';

function makeLanSync(indexes: Record<string, LanIndex | null>, entities: Record<string, unknown>) {
    return {
        pullIndex: vi.fn(async (domain: string) => indexes[domain] ?? null),
        fetchEntity: vi.fn(async (_domain: string, entityId: string) => entities[entityId] ?? null),
        syncEntity: vi.fn(),
        pullAllUsers: vi.fn(),
    } as unknown as LanDomainSyncService;
}

function makeSqlite(cursorRows: Record<string, { last_event_id: string }[]> = {}) {
    const executed: { sql: string; params: unknown[] }[] = [];
    return {
        port: {
            query: vi.fn(async (_sql: string, params?: unknown[]) => {
                const domain = params?.[0] as string;
                return cursorRows[domain] ?? [];
            }),
            execute: vi.fn(async (sql: string, params?: unknown[]) => {
                executed.push({ sql, params: params ?? [] });
            }),
        } as unknown as SqlitePort,
        executed,
    };
}

describe('LanPullService', () => {
    let lanSync: LanDomainSyncService;
    let sqlite: ReturnType<typeof makeSqlite>;
    let service: LanPullService;

    beforeEach(() => {
        const index: LanIndex = {
            last_entity_uuid: 'task-2',
            entities: {
                'task-1': { v: 1, hash: 'abc', last_event_id: '019-aaa' },
                'task-2': { v: 2, hash: 'def', last_event_id: '019-bbb' },
            },
        };

        const entities: Record<string, unknown> = {
            'task-1': { id: 'task-1', titulo: 'Tarefa 1', status: 'a_fazer', prioridade: 'media', ordem: 0 },
            'task-2': { id: 'task-2', titulo: 'Tarefa 2', status: 'concluido', prioridade: 'alta', ordem: 1 },
        };

        lanSync = makeLanSync({ tarefas: index }, entities);
        sqlite = makeSqlite();
        service = new LanPullService(lanSync, sqlite.port);
    });

    it('pullDomain ingere entidades novas quando cursor está vazio', async () => {
        const count = await service.pullDomain('tarefas');
        expect(count).toBe(2);
        expect(lanSync.fetchEntity).toHaveBeenCalledTimes(2);

        const upserts = sqlite.executed.filter(e => e.sql.includes('INSERT INTO tarefas'));
        expect(upserts).toHaveLength(2);
    });

    it('pullDomain pula entidades já processadas (cursor avançado)', async () => {
        sqlite = makeSqlite({ tarefas: [{ last_event_id: '019-aaa' }] });
        service = new LanPullService(lanSync, sqlite.port);

        const count = await service.pullDomain('tarefas');
        expect(count).toBe(1);
        expect(lanSync.fetchEntity).toHaveBeenCalledWith('tarefas', 'task-2');
    });

    it('pullDomain retorna 0 quando LAN não configurada', async () => {
        lanSync = makeLanSync({}, {});
        service = new LanPullService(lanSync, sqlite.port);

        const count = await service.pullDomain('tarefas');
        expect(count).toBe(0);
    });

    it('pullDomain retorna 0 para domínio desconhecido', async () => {
        const count = await service.pullDomain('nao_existe');
        expect(count).toBe(0);
    });

    it('pullDomain atualiza cursor após ingestão', async () => {
        await service.pullDomain('tarefas');

        const cursorUpdates = sqlite.executed.filter(e => e.sql.includes('tbl_lan_sync_cursors'));
        expect(cursorUpdates).toHaveLength(1);
        expect(cursorUpdates[0].params[0]).toBe('tarefas');
        expect(cursorUpdates[0].params[1]).toBe('019-bbb');
    });

    it('pullAll retorna summary com todos os domínios', async () => {
        const summary = await service.pullAll();
        expect(summary.totalIngested).toBe(2);
        expect(summary.domains.tarefas).toBe(2);
        expect(summary.domains.demandas).toBe(0);
        expect(summary.errors).toHaveLength(0);
        expect(summary.durationMs).toBeGreaterThanOrEqual(0);
    });
});
