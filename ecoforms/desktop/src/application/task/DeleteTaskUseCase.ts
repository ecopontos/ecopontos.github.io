import type { TaskRepository } from '../../domain/task/TaskRepository';

export class DeleteTaskUseCase {
    constructor(private readonly tasks: TaskRepository) {}

    async execute(id: string): Promise<void> {
        await this.tasks.delete(id);
    }
}
