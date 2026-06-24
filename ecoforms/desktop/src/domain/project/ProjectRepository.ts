import type { KanbanProject, Interessado, ProjetoStatus } from '@/types';

export interface ProjectWithMetrics extends KanbanProject {
    cnt_a_fazer: number;
    cnt_em_progresso: number;
    cnt_concluido: number;
    total_tarefas: number;
    cnt_baixa: number;
    cnt_media: number;
    cnt_alta: number;
}

export interface ProjectPatch {
    nome?: string;
    descricao?: string;
    cor?: string;
    status?: ProjetoStatus;
    data_inicio?: string | null;
    data_fim?: string | null;
    responsavel_id?: string | null;
    interessados?: Interessado[];
}

export interface ProjectRepository {
    findAllWithMetrics(userId: string, isAdminOrManager: boolean): Promise<ProjectWithMetrics[]>;
    createProject(
        nome: string,
        descricao: string,
        cor: string,
        userId: string,
        interessados: Interessado[],
        extra: { status?: ProjetoStatus; data_inicio?: string | null; data_fim?: string | null; responsavel_id?: string | null; setor_id?: string | null }
    ): Promise<string>;
    updateProject(projectId: string, patch: ProjectPatch): Promise<void>;
    archiveProject(projectId: string, arquivadoPor: string): Promise<void>;
    unarchiveProject(projectId: string): Promise<void>;
}
