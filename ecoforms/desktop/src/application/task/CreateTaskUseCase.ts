import { Task } from '../../domain/task/Task';
import type { TaskRepository } from '../../domain/task/TaskRepository';
import type { ClockPort } from '../ports/ClockPort';
import type { SqlitePort } from '../ports/SqlitePort';
import type { CreateTaskInput, TaskDto } from './dto/TaskDto';
import { toTaskDto } from './mappers';
import { resolveSetorId } from '../shared/resolveSetorId';
import { getEffectiveSectors } from '../../infrastructure/persistence/SectorQueryUtils';
import { uuidv7 } from 'ecoforms-core';

export class CreateTaskUseCase {
    constructor(
        private readonly tasks: TaskRepository,
        private readonly clock: ClockPort,
        private readonly db?: SqlitePort,
    ) {}

    async execute(input: CreateTaskInput): Promise<TaskDto> {
        const now = this.clock.nowIso();
        const status = 'a_fazer' as const;
        const projetoId = input.projetoId ?? null;
        const ordem = await this.tasks.nextOrder(projetoId, status);

        const setorId = this.db
            ? await resolveSetorId(
                { setorId: input.setorId },
                input.criadoPor,
                this.db,
                getEffectiveSectors,
            )
            : (input.setorId ?? null);

        const task = Task.fromProps({
            id: uuidv7(),
            titulo: input.titulo.trim(),
            status,
            prioridade: input.prioridade ?? 'media',
            ordem,
            criadoPor: input.criadoPor,
            projetoId,
            descricao: input.descricao,
            atribuidoPara: input.atribuidoPara ?? null,
            prazo: input.prazo ?? null,
            prazoFim: input.prazoFim ?? null,
            tipoPrazo: input.tipoPrazo ?? null,
            formRegistryId: input.formRegistryId ?? null,
            parentTaskId: input.parentTaskId ?? null,
            demandaId: input.demandaId ?? null,
            setorId,
            arquivado: false,
            criadoEm: now,
            atualizadoEm: now,
        });

        if (!task.titulo) throw new Error('Título da tarefa é obrigatório.');

        await this.tasks.save(task);
        return toTaskDto(task);
    }
}
