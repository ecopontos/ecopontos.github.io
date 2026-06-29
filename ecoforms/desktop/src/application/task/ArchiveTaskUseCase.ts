import { NotFoundError } from '../../domain/shared/errors';
import type { TaskRepository } from '../../domain/task/TaskRepository';
import type { DemandaTaskSynchronizer } from '../demanda/services/DemandaTaskSynchronizer';
import type { SyncOutbox } from '../ports/SyncOutboxPort';
import type { TaskDto } from './dto/TaskDto';
import { toTaskDto } from './mappers';

export class ArchiveTaskUseCase {
    constructor(
        private readonly tasks: TaskRepository,
        private readonly synchronizer: DemandaTaskSynchronizer,
        private readonly sync: SyncOutbox,
    ) {}

    async execute(id: string): Promise<TaskDto> {
        const task = await this.tasks.findById(id);
        if (!task) throw new NotFoundError('Task', id);
        const demandaId = task.demandaId;
        task.archive();
        await this.tasks.save(task);

        await this.synchronizer.aoArquivarTask(task.id, demandaId ?? null);
        await this.sync.write('task.arquivada', {
            tarefa_id: task.id,
            demanda_id: demandaId ?? null,
        }, { aggregateId: task.id, streamId: demandaId ?? undefined });

        return toTaskDto(task);
    }
}
