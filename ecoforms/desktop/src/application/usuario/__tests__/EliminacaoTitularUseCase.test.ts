import { describe, expect, it, beforeEach } from 'vitest';
import { EliminacaoTitularUseCase } from '../EliminacaoTitularUseCase';
import { USUARIO_MAPEAMENTO_SUPABASE } from '../../../infrastructure/persistence/sqlite/queries/usuarios';
import { FakeSqlitePort } from '../../../test/fakes/FakeSqlitePort';
import { FakeFileStorage } from '../../../test/fakes/FakeFileStorage';
import { FakeSupabaseAdmin } from '../../../test/fakes/FakeSupabaseAdmin';

describe('EliminacaoTitularUseCase', () => {
    let sqlite: FakeSqlitePort;
    let fileStorage: FakeFileStorage;
    let supabaseAdmin: FakeSupabaseAdmin;
    let sut: EliminacaoTitularUseCase;

    beforeEach(() => {
        sqlite = new FakeSqlitePort();
        fileStorage = new FakeFileStorage();
        supabaseAdmin = new FakeSupabaseAdmin();
        sut = new EliminacaoTitularUseCase(sqlite, fileStorage, supabaseAdmin);
    });

    it('remove dados locais e supabase quando executado por admin', async () => {
        sqlite.setQueryResult(USUARIO_MAPEAMENTO_SUPABASE.sql, [{ id_supabase: 'sup-123' }]);
        fileStorage.seed('sync-bucket', 'users/u-1/images/foto.png', 'imagem');

        const result = await sut.execute('u-1', 'admin');

        expect(result.erros).toHaveLength(0);
        expect(result.storageRemovido).toBe(true);
        expect(result.supabasePerfilRemovido).toBe(true);
        expect(result.supabaseAuthRemovido).toBe(true);
        expect(result.tabelas).toHaveLength(7);
        expect(sqlite.executeCalls).toHaveLength(7);
        expect(fileStorage.lists).toEqual([{ bucket: 'sync-bucket', prefix: 'users/u-1/images/' }]);
        expect(fileStorage.removals).toEqual([{ bucket: 'sync-bucket', paths: ['users/u-1/images/foto.png'] }]);
        expect(supabaseAdmin.deletedProfiles).toEqual(['sup-123']);
        expect(supabaseAdmin.deletedAuthUsers).toEqual(['sup-123']);
    });

    it('bloqueia requestor sem perfil admin', async () => {
        await expect(sut.execute('u-1', 'operador')).rejects.toThrow('Apenas administradores');
    });
});
