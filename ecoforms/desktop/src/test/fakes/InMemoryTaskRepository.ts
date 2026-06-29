import { Task } from '../../domain/task/Task';
import type { TaskQuery, TaskRepository } from '../../domain/task/TaskRepository';
import type { TaskStatus } from '../../domain/task/TaskStatus';

export class InMemoryTaskRepository implements TaskRepository {
    private store = new Map<string, Task>();

    async transaction<T>(fn: (tx: TaskRepository) => Promise<T>): Promise<T> {
        return fn(this);
    }

    async findById(id: string): Promise<Task | null> {
        return this.store.get(id) ?? null;
    }

    async findByProject(projectId: string | null, includeArchived = false): Promise<Task[]> {
        return [...this.store.values()]
            .filter((t) => (t.projetoId ?? null) === projectId)
            .filter((t) => includeArchived || !t.arquivado)
            .sort((a, b) => a.ordem - b.ordem);
    }

    async query(filter: TaskQuery): Promise<Task[]> {
        return [...this.store.values()].filter((t) => {
            if (filter.projectId !== undefined && (t.projetoId ?? null) !== filter.projectId) return false;
            if (filter.status && t.status !== filter.status) return false;
            if (filter.assignedTo && t.atribuidoPara !== filter.assignedTo) return false;
            if (filter.createdBy && t.criadoPor !== filter.createdBy) return false;
            if (!filter.includeArchived && t.arquivado) return false;
            return true;
        });
    }

    async save(task: Task): Promise<void> {
        this.store.set(task.id, task);
    }

    async delete(id: string): Promise<void> {
        this.store.delete(id);
    }

    async nextOrder(projectId: string | null, status: TaskStatus): Promise<number> {
        const max = [...this.store.values()]
            .filter((t) => (t.projetoId ?? null) === projectId && t.status === status)
            .reduce((acc, t) => Math.max(acc, t.ordem), 0);
        return max + 1000;
    }

    async findByDemandaId(demandaId: string): Promise<Task[]> {
        return [...this.store.values()].filter((t) => t.demandaId === demandaId);
    }

    async findByOrigin(origemTipo: string, origemId: string): Promise<Task[]> {
        return [...this.store.values()].filter((t) => {
            const p = t.toProps();
            return p.origemTipo === origemTipo && p.origemId === origemId;
        });
    }

    async addComment(): Promise<void> {
        // noop in memory
    }

    async findAssignedActiveForms(): Promise<string[]> {
        return [];
    }

    async getTaskHistory(): Promise<import('../../domain/task/TaskRepository').TaskHistoryEvent[]> {
        return [];
    }
}
