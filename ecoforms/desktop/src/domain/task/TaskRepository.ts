import type { Task } from './Task';
import type { TaskStatus } from './TaskStatus';

export interface TaskQuery {
    projectId?: string | null;
    status?: TaskStatus;
    assignedTo?: string;
    createdBy?: string;
    includeArchived?: boolean;
}

export interface TaskHistoryEvent {
    id: string;
    tarefaId: string;
    tipo: string;
    descricao: string | null;
    usuarioId: string | null;
    usuarioNome: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
}

export interface TaskRepository {
    findById(id: string): Promise<Task | null>;
    findByProject(projectId: string | null, includeArchived?: boolean): Promise<Task[]>;
    query(filter: TaskQuery): Promise<Task[]>;
    save(task: Task): Promise<void>;
    delete(id: string): Promise<void>;
    nextOrder(projectId: string | null, status: TaskStatus): Promise<number>;
    findByDemandaId(demandaId: string): Promise<Task[]>;
    findByOrigin(origemTipo: string, origemId: string): Promise<Task[]>;
    addComment(tarefaId: string, usuarioId: string, comentario: string): Promise<void>;
    findAssignedActiveForms(userId: string): Promise<string[]>;
    getTaskHistory(taskId: string): Promise<TaskHistoryEvent[]>;
}
