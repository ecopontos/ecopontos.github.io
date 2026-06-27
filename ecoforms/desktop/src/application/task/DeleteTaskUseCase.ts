import type { TaskRepository } from '../../domain/task/TaskRepository';
import type { SyncOutbox } from '../ports/SyncOutboxPort';

export class DeleteTaskUseCase {
    constructor(
        private readonly tasks: TaskRepository,
        private readonly sync: SyncOutbox,
    ) {}

    async execute(id: string): Promise<void> {
        // Busca antes de excluir para obter o demanda_id (streamId do evento).
        const task = await this.tasks.findById(id);
        await this.tasks.delete(id);

        await this.sync.write('task.excluida', {
            tarefa_id: id,
            demanda_id: task?.demandaId ?? null,
        }, { aggregateId: id, streamId: task?.demandaId ?? undefined });
    }
}
