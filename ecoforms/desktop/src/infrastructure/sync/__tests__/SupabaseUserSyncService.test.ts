import { describe, expect, it, vi } from 'vitest';
import { SupabaseUserSyncService } from '../SupabaseUserSyncService';
import type { SqlitePort } from '../../../application/ports/SqlitePort';
import type { SqliteUserRepository } from '../../persistence/sqlite/SqliteUserRepository';

function makeUserRepo() {
    return {
        save: vi.fn(async () => {}),
        findAll: vi.fn(async () => []),
        findById: vi.fn(async () => null),
        delete: vi.fn(async () => {}),
    } as unknown as SqliteUserRepository;
}

function makeSqlite(queryImpl?: (sql: string, params?: unknown[]) => unknown[]) {
    return {
        query: vi.fn(async (sql: string, params?: unknown[]) => queryImpl ? queryImpl(sql, params) : []),
        execute: vi.fn(async () => {}),
        all: vi.fn(async () => []),
        transaction: vi.fn(async <T>(callback: () => Promise<T>) => callback()),
    } as unknown as SqlitePort;
}

describe('SupabaseUserSyncService', () => {
    it('persiste relacionamento usando a coluna id_supabase', async () => {
        const userRepo = makeUserRepo();
        const sqlite = makeSqlite();
        const service = new SupabaseUserSyncService(userRepo, sqlite);

        await service.syncFromSupabase([
            {
                id: 'sup-1',
                nome: 'Usu?rio 1',
                email: 'user1@example.com',
                perfil: 'operador',
                ativo: true,
                org_id: 'org-1',
            },
        ]);

        const querySql = vi.mocked(sqlite.query).mock.calls[0]?.[0];
        const [insertSql, insertParams] = vi.mocked(sqlite.execute).mock.calls[0] as [string, unknown[]];
        expect(querySql).toContain('id_supabase');
        expect(querySql).not.toContain('supabase_id');
        expect(insertSql).toContain('(local_id, id_supabase)');
        expect(insertSql).not.toContain('supabase_id');
        expect(insertParams[1]).toBe('sup-1');
    });

    it('consulta id_supabase ao desativar usu?rios ausentes no Supabase', async () => {
        const userRepo = makeUserRepo();
        vi.mocked(userRepo.findAll).mockResolvedValue([{ id: 'local-1', ativo: true }] as never);
        const sqlite = makeSqlite((sql) => {
            if (sql.includes('WHERE local_id = ?')) {
                return [{ id_supabase: 'sup-1' }];
            }
            return [];
        });
        const service = new SupabaseUserSyncService(userRepo, sqlite);

        const deactivated = await service.syncDeactivated([]);

        expect(deactivated).toBe(1);
        expect(vi.mocked(sqlite.query).mock.calls[0]?.[0]).toContain('id_supabase');
        expect(vi.mocked(sqlite.query).mock.calls[0]?.[0]).not.toContain('supabase_id');
        expect(vi.mocked(userRepo.delete)).toHaveBeenCalledWith('local-1');
    });
});
