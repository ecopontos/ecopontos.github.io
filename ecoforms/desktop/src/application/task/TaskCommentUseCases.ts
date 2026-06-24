import type { TaskRepository } from '../../domain/task/TaskRepository';

export class AddTaskCommentUseCase {
    constructor(private readonly tasks: TaskRepository) {}

    async execute(tarefaId: string, usuarioId: string, comentario: string): Promise<void> {
        return this.tasks.addComment(tarefaId, usuarioId, comentario);
    }
}

export class FindAssignedActiveFormsUseCase {
    constructor(private readonly tasks: TaskRepository) {}

    async execute(userId: string): Promise<string[]> {
        return this.tasks.findAssignedActiveForms(userId);
    }
}
