import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MoveTaskUseCase } from '../MoveTaskUseCase';
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

function makeFakeSynchronizer() {
    return {
        aoMoverTask: vi.fn(),
        aoArquivarTask: vi.fn(),
        aoEncerrarDemanda: vi.fn(),
    } as unknown as DemandaTaskSynchronizer;
}

describe('MoveTaskUseCase', () => {
    let repo: InMemoryTaskRepository;
    let synchronizer: DemandaTaskSynchronizer;
    let syncOutbox: SyncOutbox;
    let fakeSync: ReturnType<typeof makeFakeSyncOutbox>;
    let sut: MoveTaskUseCase;

    beforeEach(() => {
        repo = new InMemoryTaskRepository();
        synchronizer = makeFakeSynchronizer();
        fakeSync = makeFakeSyncOutbox();
        syncOutbox = fakeSync.outbox;
        sut = new MoveTaskUseCase(repo, synchronizer, syncOutbox);
    });

    async function seedTask(status: 'a_fazer' | 'em_progresso' | 'concluido' = 'a_fazer', ordem = 1000) {
        const task = Task.fromProps({
            id: 'task-1',
            titulo: 'Tarefa teste',
            status,
            prioridade: 'media',
            ordem,
            criadoPor: 'user-1',
            projetoId: null,
            arquivado: false,
            criadoEm: '2026-04-28T10:00:00Z',
            atualizadoEm: '2026-04-28T10:00:00Z',
        });
        await repo.save(task);
        return task;
    }

    it('deve mover tarefa de a_fazer para em_progresso', async () => {
        await seedTask('a_fazer');

        const result = await sut.execute({ id: 'task-1', to: 'em_progresso' });

        expect(result.status).toBe('em_progresso');
        const saved = await repo.findById('task-1');
        expect(saved?.status).toBe('em_progresso');
    });

    it('deve lançar erro ao tentar mover para status inválido', async () => {
        await seedTask('a_fazer');

        await expect(sut.execute({ id: 'task-1', to: 'concluido' })).rejects.toThrow();
    });

    it('deve lançar NotFoundError quando tarefa não existe', async () => {
        await expect(sut.execute({ id: 'inexistente', to: 'em_progresso' })).rejects.toThrow('Task');
    });

    it('deve atualizar ordem quando informada', async () => {
        await seedTask('a_fazer', 1000);

        const result = await sut.execute({ id: 'task-1', to: 'em_progresso', ordem: 500 });

        expect(result.ordem).toBe(500);
    });

    it('deve chamar synchronizer.aoMoverTask quando tarefa tem demandaId ao mover para em_progresso', async () => {
        const task = Task.fromProps({
            id: 'task-demand',
            titulo: 'Tarefa com demanda',
            status: 'a_fazer',
            prioridade: 'media',
            ordem: 1000,
            criadoPor: 'user-1',
            projetoId: null,
            demandaId: 'demanda-1',
            arquivado: false,
        });
        await repo.save(task);

        await sut.execute({ id: 'task-demand', to: 'em_progresso' });

        expect(synchronizer.aoMoverTask).toHaveBeenCalledWith('task-demand', 'demanda-1', 'em_progresso');
        expect(fakeSync.writes.some(w => w.type === 'task.movida')).toBe(true);
    });

    it('NÃO deve chamar synchronizer quando tarefa não tem demandaId', async () => {
        await seedTask('a_fazer');

        await sut.execute({ id: 'task-1', to: 'em_progresso' });

        expect(synchronizer.aoMoverTask).not.toHaveBeenCalled();
    });

    it('deve publicar sync.task.concluida quando tarefa com demandaId é concluída', async () => {
        const task = Task.fromProps({
            id: 'task-conclude',
            titulo: 'Tarefa a concluir',
            status: 'em_progresso',
            prioridade: 'media',
            ordem: 1000,
            criadoPor: 'user-1',
            projetoId: null,
            demandaId: 'demanda-2',
            arquivado: false,
        });
        await repo.save(task);

        await sut.execute({ id: 'task-conclude', to: 'concluido' });

        expect(fakeSync.writes.some(w => w.type === 'task.concluida' && w.data['tarefa_id'] === 'task-conclude')).toBe(true);
    });
});
