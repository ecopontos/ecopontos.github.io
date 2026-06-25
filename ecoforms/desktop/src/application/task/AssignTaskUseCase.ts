import { NotFoundError } from '../../domain/shared/errors';
import type { TaskRepository } from '../../domain/task/TaskRepository';
import type { AssignTaskInput, TaskDto } from './dto/TaskDto';
import { toTaskDto } from './mappers';

export class AssignTaskUseCase {
    constructor(private readonly tasks: TaskRepository) {}

    async execute(input: AssignTaskInput): Promise<TaskDto> {
        const task = await this.tasks.findById(input.id);
        if (!task) throw new NotFoundError('Task', input.id);
        task.assignTo(input.atribuidoPara);
        await this.tasks.save(task);
        return toTaskDto(task);
    }
}
