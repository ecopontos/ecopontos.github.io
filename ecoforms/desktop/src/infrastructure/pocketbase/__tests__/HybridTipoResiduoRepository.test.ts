import { describe, expect, it, vi } from 'vitest';
import { TipoResiduo } from '../../../domain/tipo-residuo/TipoResiduo';
import type { TipoResiduoRepository } from '../../../domain/tipo-residuo/TipoResiduoRepository';
import { HybridTipoResiduoRepository } from '../HybridTipoResiduoRepository';

function makeTipoResiduo(): TipoResiduo {
    return TipoResiduo.fromProps({
        id: 'tipo-1',
        codigo: 'REC',
        nome: 'Reciclavel',
        descricao: null,
        cor: '#16a34a',
        ativo: true,
        criadoEm: '2026-06-29T12:00:00.000Z',
    });
}

function makeRepository(): TipoResiduoRepository {
    return {
        findAll: vi.fn(async () => [makeTipoResiduo()]),
        findAtivos: vi.fn(async () => [makeTipoResiduo()]),
        findById: vi.fn(async () => makeTipoResiduo()),
        findByCodigo: vi.fn(async () => makeTipoResiduo()),
        save: vi.fn(async () => {}),
        delete: vi.fn(async () => {}),
    };
}

describe('HybridTipoResiduoRepository', () => {
    it('reads from the local repository', async () => {
        const local = makeRepository();
        const remote = makeRepository();
        const repository = new HybridTipoResiduoRepository(local, remote);

        await expect(repository.findAtivos()).resolves.toHaveLength(1);

        expect(local.findAtivos).toHaveBeenCalledOnce();
        expect(remote.findAtivos).not.toHaveBeenCalled();
    });

    it('saves locally and replicates to PocketBase', async () => {
        const local = makeRepository();
        const remote = makeRepository();
        const tipo = makeTipoResiduo();
        const repository = new HybridTipoResiduoRepository(local, remote);

        await repository.save(tipo);

        expect(local.save).toHaveBeenCalledWith(tipo);
        expect(remote.save).toHaveBeenCalledWith(tipo);
    });

    it('does not fail local save when PocketBase is unavailable', async () => {
        const local = makeRepository();
        const remote = makeRepository();
        vi.mocked(remote.save).mockRejectedValueOnce(new Error('offline'));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const repository = new HybridTipoResiduoRepository(local, remote);

        await expect(repository.save(makeTipoResiduo())).resolves.toBeUndefined();

        expect(local.save).toHaveBeenCalledOnce();
        expect(remote.save).toHaveBeenCalledOnce();
        warn.mockRestore();
    });

    it('deletes locally even when remote delete fails', async () => {
        const local = makeRepository();
        const remote = makeRepository();
        vi.mocked(remote.delete).mockRejectedValueOnce(new Error('offline'));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const repository = new HybridTipoResiduoRepository(local, remote);

        await expect(repository.delete('tipo-1')).resolves.toBeUndefined();

        expect(local.delete).toHaveBeenCalledWith('tipo-1');
        expect(remote.delete).toHaveBeenCalledWith('tipo-1');
        warn.mockRestore();
    });
});
