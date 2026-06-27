import type { TaskRepository } from '../../domain/task/TaskRepository';
import type { SyncOutbox } from '../ports/SyncOutboxPort';

export class AddTaskCommentUseCase {
    constructor(
        private readonly tasks: TaskRepository,
        private readonly sync: SyncOutbox,
    ) {}

    async execute(tarefaId: string, usuarioId: string, comentario: string): Promise<void> {
        await this.tasks.addComment(tarefaId, usuarioId, comentario);
        await this.sync.write('task.comentario_adicionado', {
            tarefa_id: tarefaId,
            usuario_id: usuarioId,
            comentario,
        }, { aggregateId: tarefaId });
    }
}

export class FindAssignedActiveFormsUseCase {
    constructor(private readonly tasks: TaskRepository) {}

    async execute(userId: string): Promise<string[]> {
        return this.tasks.findAssignedActiveForms(userId);
    }
}
