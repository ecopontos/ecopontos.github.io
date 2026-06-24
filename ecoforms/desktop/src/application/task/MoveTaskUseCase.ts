import { NotFoundError } from '../../domain/shared/errors';
import type { TaskRepository } from '../../domain/task/TaskRepository';
import type { DemandaTaskSynchronizer } from '../demanda/services/DemandaTaskSynchronizer';
import type { SyncOutbox } from '../../infrastructure/sync/SyncOutbox';
import type { MoveTaskInput, TaskDto } from './dto/TaskDto';
import { toTaskDto } from './mappers';
import { isTerminalStatus } from '../../domain/task/TaskStatus';

export class MoveTaskUseCase {
    constructor(
        private readonly tasks: TaskRepository,
        private readonly synchronizer: DemandaTaskSynchronizer,
        private readonly sync: SyncOutbox,
    ) {}

    async execute(input: MoveTaskInput): Promise<TaskDto> {
        const task = await this.tasks.findById(input.id);
        if (!task) throw new NotFoundError('Task', input.id);

        if (isTerminalStatus(task.status) && task.status === input.to) {
            console.warn(`[MoveTaskUseCase] Tarefa ${input.id} já está em estado terminal "${task.status}" — operação ignorada.`);
            return toTaskDto(task);
        }

        task.transitionTo(input.to);
        if (input.ordem !== undefined) task.reorder(input.ordem);

        await this.tasks.save(task);

        if (task.demandaId && (input.to === 'em_progresso' || input.to === 'concluido')) {
            await this.synchronizer.aoMoverTask(task.id, task.demandaId, input.to);
        }

        if (input.to === 'em_progresso') {
            await this.sync.write('task.movida', {
                tarefa_id: task.id,
                novo_status: 'em_andamento',
                demanda_id: task.demandaId ?? null,
            }, { aggregateId: task.id, streamId: task.demandaId ?? undefined });
        } else if (input.to === 'concluido') {
            await this.sync.write('task.concluida', {
                tarefa_id: task.id,
                demanda_id: task.demandaId ?? null,
            }, { aggregateId: task.id, streamId: task.demandaId ?? undefined });
        }

        return toTaskDto(task);
    }
}
