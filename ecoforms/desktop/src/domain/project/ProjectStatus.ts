export type ProjectStatus = 'ativo' | 'pausado' | 'concluido' | 'cancelado';

const VALID_TRANSITIONS: Record<ProjectStatus, readonly ProjectStatus[]> = {
    ativo: ['pausado', 'concluido', 'cancelado'],
    pausado: ['ativo', 'concluido', 'cancelado'],
    concluido: [],
    cancelado: [],
};

export function isValidProjectTransition(from: ProjectStatus, to: ProjectStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalProjectStatus(status: ProjectStatus): boolean {
    return VALID_TRANSITIONS[status].length === 0;
}
