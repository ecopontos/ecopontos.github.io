import { NotFoundError } from '../../domain/shared/errors';
import type { TaskRepository } from '../../domain/task/TaskRepository';
import type { SyncOutbox } from '../../infrastructure/sync/SyncOutbox';
import type { TaskDto } from './dto/TaskDto';
import { toTaskDto } from './mappers';

export class UnarchiveTaskUseCase {
    constructor(
        private readonly tasks: TaskRepository,
        private readonly sync: SyncOutbox,
    ) {}

    async execute(id: string): Promise<TaskDto> {
        const task = await this.tasks.findById(id);
        if (!task) throw new NotFoundError('Task', id);
        task.unarchive();
        await this.tasks.save(task);

        await this.sync.write('task.desarquivada', {
            tarefa_id: task.id,
            demanda_id: task.demandaId ?? null,
        }, { aggregateId: task.id, streamId: task.demandaId ?? undefined });

        return toTaskDto(task);
    }
}
