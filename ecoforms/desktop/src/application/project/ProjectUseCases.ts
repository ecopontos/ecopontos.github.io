import type { ProjectRepository, ProjectWithMetrics, ProjectPatch } from '../../domain/project/ProjectRepository';
import type { Interessado, ProjetoStatus } from '@/types';

export class ListProjectsWithMetricsUseCase {
    constructor(private readonly repo: ProjectRepository) {}
    async execute(userId: string, isAdminOrManager: boolean): Promise<ProjectWithMetrics[]> {
        return this.repo.findAllWithMetrics(userId, isAdminOrManager);
    }
}

export class CreateProjectUseCase {
    constructor(private readonly repo: ProjectRepository) {}
    async execute(
        nome: string,
        descricao: string,
        cor: string,
        userId: string,
        interessados: Interessado[],
        extra: { status?: ProjetoStatus; data_inicio?: string | null; data_fim?: string | null; responsavel_id?: string | null; setor_id?: string | null }
    ): Promise<string> {
        return this.repo.createProject(nome, descricao, cor, userId, interessados, extra);
    }
}

export class UpdateProjectUseCase {
    constructor(private readonly repo: ProjectRepository) {}
    async execute(projectId: string, patch: ProjectPatch): Promise<void> {
        return this.repo.updateProject(projectId, patch);
    }
}

export class ArchiveProjectUseCase {
    constructor(private readonly repo: ProjectRepository) {}
    async execute(projectId: string, arquivadoPor: string): Promise<void> {
        return this.repo.archiveProject(projectId, arquivadoPor);
    }
}

export class UnarchiveProjectUseCase {
    constructor(private readonly repo: ProjectRepository) {}
    async execute(projectId: string): Promise<void> {
        return this.repo.unarchiveProject(projectId);
    }
}
