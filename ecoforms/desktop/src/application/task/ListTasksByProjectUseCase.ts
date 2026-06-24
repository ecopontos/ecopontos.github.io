import type { TaskRepository } from '../../domain/task/TaskRepository';
import type { TaskDto } from './dto/TaskDto';
import { toTaskDto } from './mappers';

export interface ListTasksByProjectInput {
    projectId: string | null;
    includeArchived?: boolean;
}

export class ListTasksByProjectUseCase {
    constructor(private readonly tasks: TaskRepository) {}

    async execute(input: ListTasksByProjectInput): Promise<TaskDto[]> {
        const tasks = await this.tasks.findByProject(input.projectId, input.includeArchived);
        return tasks.map(toTaskDto);
    }
}
