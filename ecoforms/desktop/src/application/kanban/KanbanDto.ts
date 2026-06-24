import type { KanbanProject, UnifiedTaskView } from '@/types';

export interface KanbanData {
    projects: KanbanProject[];
    tasks: UnifiedTaskView[];
    solicitacoes: UnifiedTaskView[];
}

export interface GetKanbanDataInput {
    userId: string;
    perfil: string;
    setor: string | null;
    isAdmin: boolean;
    isManager: boolean;
    accessiblePerfis: string[];
    showAllProjects: boolean;
    currentProjectId: string | null;
}
