import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateTaskUseCase } from '../CreateTaskUseCase';
import { InMemoryTaskRepository } from '../../../test/fakes/InMemoryTaskRepository';
import { FixedClock } from '../../../test/fakes/FixedClock';

vi.mock('ecoforms-core', () => {
    let counter = 0;
    return {
        uuidv7: vi.fn(() => { counter++; return `task-uuid-${counter}`; }),
    };
});

describe('CreateTaskUseCase', () => {
    let repo: InMemoryTaskRepository;
    let clock: FixedClock;
    let sut: CreateTaskUseCase;

    beforeEach(() => {
        repo = new InMemoryTaskRepository();
        clock = new FixedClock('2026-04-28T10:00:00Z');
        sut = new CreateTaskUseCase(repo, clock);
    });

    it('deve criar uma tarefa com status a_fazer e ordem 1000 quando não há tarefas no projeto', async () => {
        const result = await sut.execute({
            titulo: 'Nova tarefa',
            criadoPor: 'user-1',
            projetoId: null,
        });

        expect(result.id).toBe('task-uuid-1');
        expect(result.titulo).toBe('Nova tarefa');
        expect(result.status).toBe('a_fazer');
        expect(result.ordem).toBe(1000);
        expect(result.criadoPor).toBe('user-1');
        expect(result.arquivado).toBe(false);
        expect(result.criadoEm).toBe('2026-04-28T10:00:00.000Z');
    });

    it('deve criar tarefa com prioridade media por padrao', async () => {
        const result = await sut.execute({
            titulo: 'Tarefa default',
            criadoPor: 'user-1',
        });

        expect(result.prioridade).toBe('media');
    });

    it('deve lançar erro quando título é vazio', async () => {
        await expect(
            sut.execute({ titulo: '   ', criadoPor: 'user-1' }),
        ).rejects.toThrow('Título da tarefa é obrigatório.');
    });

    it('deve incrementar ordem quando já existem tarefas no mesmo projeto e status', async () => {
        const existing = await sut.execute({ titulo: 'Existente', criadoPor: 'user-1', projetoId: 'p1' });
        expect(existing.ordem).toBe(1000);

        const result = await sut.execute({ titulo: 'Segunda', criadoPor: 'user-1', projetoId: 'p1' });
        expect(result.ordem).toBe(2000);
    });
});
