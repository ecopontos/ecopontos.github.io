import type { KanbanTask } from '@/types';

const ACTIVE_RUNTIME_STATUSES = new Set<KanbanTask['status']>(['a_fazer', 'em_progresso']);

export interface KanbanMutationBehavior {
    runtimeValidation: boolean;
    autoSync: boolean;
}

const DEFAULT_BEHAVIOR: KanbanMutationBehavior = {
    runtimeValidation: true,
    autoSync: true,
};

type RuntimeTaskCandidate = Partial<Pick<KanbanTask, 'status' | 'atribuido_para' | 'form_registry_id'>>;

export function resolveKanbanMutationBehavior(options?: Partial<KanbanMutationBehavior>): KanbanMutationBehavior {
    return { ...DEFAULT_BEHAVIOR, ...options };
}

export function requiresRuntimeForm(behavior: KanbanMutationBehavior, task: RuntimeTaskCandidate): boolean {
    if (!behavior.runtimeValidation) return false;
    const isAssigned = Boolean(task.atribuido_para);
    const isActive = ACTIVE_RUNTIME_STATUSES.has(task.status || 'a_fazer');
    const hasForm = Boolean(task.form_registry_id);
    return isAssigned && isActive && !hasForm;
}