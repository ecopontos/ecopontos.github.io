import type { TaskPriority } from '../../../domain/task/Task';
import type { TaskStatus } from '../../../domain/task/TaskStatus';

export interface TaskDto {
    id: string;
    titulo: string;
    status: TaskStatus;
    prioridade: TaskPriority;
    ordem: number;
    criadoPor: string;
    projetoId: string | null;
    descricao?: string;
    atribuidoPara: string | null;
    prazo: string | null;
    prazoFim: string | null;
    tipoPrazo: 'unico' | 'periodo' | 'recorrente' | null;
    formRegistryId: string | null;
    tblSuiteId: number | string | null;
    parentTaskId: string | null;
    demandaId: string | null;
    arquivado: boolean;
    recorrencia?: string | null;
    setorId?: string | null;
    origemTipo?: string | null;
    origemId?: string | null;
    criadoEm?: string;
    atualizadoEm?: string;
}

export interface CreateTaskInput {
    titulo: string;
    criadoPor: string;
    projetoId?: string | null;
    descricao?: string;
    prioridade?: TaskPriority;
    atribuidoPara?: string | null;
    prazo?: string | null;
    prazoFim?: string | null;
    tipoPrazo?: 'unico' | 'periodo' | 'recorrente' | null;
    formRegistryId?: string | null;
    parentTaskId?: string | null;
    demandaId?: string | null;
    setorId?: string | null;
}

export interface MoveTaskInput {
    id: string;
    to: TaskStatus;
    ordem?: number;
}

export interface AssignTaskInput {
    id: string;
    atribuidoPara: string | null;
}
