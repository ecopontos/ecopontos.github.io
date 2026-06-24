import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArchiveTaskUseCase } from '../ArchiveTaskUseCase';
import { InMemoryTaskRepository } from '../../../test/fakes/InMemoryTaskRepository';
import { Task } from '../../../domain/task/Task';
import type { DemandaTaskSynchronizer } from '../../demanda/services/DemandaTaskSynchronizer';
import type { SyncOutbox } from '../../../infrastructure/sync/SyncOutbox';

function makeFakeSyncOutbox() {
    const writes: Array<{ type: string; data: Record<string, unknown> }> = [];
    return {
        writes,
        outbox: {
            write: vi.fn(async (type: string, data: Record<string, unknown>) => {
                writes.push({ type, data });
            }),
        } as unknown as SyncOutbox,
    };
}

describe('ArchiveTaskUseCase', () => {
    let repo: InMemoryTaskRepository;
    let synchronizer: DemandaTaskSynchronizer;
    let syncOutbox: SyncOutbox;
    let fakeSync: ReturnType<typeof makeFakeSyncOutbox>;
    let sut: ArchiveTaskUseCase;

    beforeEach(() => {
        repo = new InMemoryTaskRepository();
        synchronizer = {
            aoMoverTask: vi.fn(),
            aoArquivarTask: vi.fn(),
            aoEncerrarDemanda: vi.fn(),
        } as unknown as DemandaTaskSynchronizer;
        fakeSync = makeFakeSyncOutbox();
        syncOutbox = fakeSync.outbox;
        sut = new ArchiveTaskUseCase(repo, synchronizer, syncOutbox);
    });

    it('deve arquivar tarefa e escrever sync.task.arquivada', async () => {
        const task = Task.fromProps({
            id: 'task-1', titulo: 'Teste', status: 'a_fazer', prioridade: 'media',
            ordem: 1000, criadoPor: 'user-1', projetoId: null, demandaId: 'demanda-1',
            arquivado: false,
        });
        await repo.save(task);

        const result = await sut.execute('task-1');

        expect(result.arquivado).toBe(true);
        expect(synchronizer.aoArquivarTask).toHaveBeenCalledWith('task-1', 'demanda-1');
        expect(fakeSync.writes.some(w => w.type === 'task.arquivada' && w.data['tarefa_id'] === 'task-1')).toBe(true);
    });

    it('deve escrever sync.task.arquivada com demandaId null quando task não tem demanda', async () => {
        const task = Task.fromProps({
            id: 'task-2', titulo: 'Teste', status: 'a_fazer', prioridade: 'media',
            ordem: 1000, criadoPor: 'user-1', projetoId: null, demandaId: undefined,
            arquivado: false,
        });
        await repo.save(task);

        await sut.execute('task-2');

        expect(fakeSync.writes.some(w => w.type === 'task.arquivada' && w.data['demanda_id'] === null)).toBe(true);
    });
});
