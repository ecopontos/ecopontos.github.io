export type TaskStatus = 'a_fazer' | 'em_progresso' | 'concluido' | 'cancelado' | 'aguardando_aprovacao';

const VALID_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
    aguardando_aprovacao: ['a_fazer', 'cancelado'],
    a_fazer: ['em_progresso', 'cancelado'],
    em_progresso: ['a_fazer', 'concluido', 'cancelado'],
    concluido: [],
    cancelado: [],
};

const STATUS_LABELS: Record<TaskStatus, string> = {
    aguardando_aprovacao: 'Aguardando Aprovação',
    a_fazer: 'A Fazer',
    em_progresso: 'Em Progresso',
    concluido: 'Concluído',
    cancelado: 'Cancelado',
};

export function getValidTransitions(from: TaskStatus): TaskStatus[] {
    return [...(VALID_TRANSITIONS[from] ?? [])];
}

export function isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalStatus(status: TaskStatus): boolean {
    return VALID_TRANSITIONS[status].length === 0;
}

export function describeTransition(from: TaskStatus, to: TaskStatus): string {
    const fromLabel = STATUS_LABELS[from] ?? from;
    const toLabel = STATUS_LABELS[to] ?? to;
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed || allowed.length === 0) {
        return `Status "${fromLabel}" é terminal e não permite transição para "${toLabel}".`;
    }
    const labels = allowed.map((s) => `"${STATUS_LABELS[s]}"`).join(', ');
    return `Não é possível mover de "${fromLabel}" para "${toLabel}". Permitidas: ${labels}.`;
}

export function statusLabel(status: TaskStatus): string {
    return STATUS_LABELS[status] ?? status;
}

export function assertValidTransition(from: TaskStatus, to: TaskStatus): void {
    if (!isValidTransition(from, to)) {
        throw new Error(describeTransition(from, to));
    }
}
