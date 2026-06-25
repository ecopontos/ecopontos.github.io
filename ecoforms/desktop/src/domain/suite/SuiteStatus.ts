/**
 * Status possíveis de um pacote suite (contrato v2).
 * Nota: 'approved' e 'rejected' são legado do v1 e ainda aparecem em dados existentes —
 * por isso continuam no union, mas não são alvo de transições novas.
 */
export type SuiteStatus =
    | 'draft'
    | 'current'
    | 'approved'
    | 'rejected'
    | 'edit'
    | 'locked'
    | 'dispatched'
    | 'pending_review'
    | 'refuted'
    | 'superseded'
    | 'closed';

const VALID_TRANSITIONS: Record<SuiteStatus, readonly SuiteStatus[]> = {
    draft: ['current', 'dispatched', 'closed'],
    current: ['edit', 'locked', 'superseded', 'pending_review', 'closed'],
    edit: ['current', 'pending_review', 'superseded'],
    locked: ['current'],
    dispatched: ['pending_review', 'closed'],
    pending_review: ['current', 'refuted', 'closed'],
    refuted: ['edit', 'closed'],
    superseded: [],
    closed: [],
    approved: ['superseded', 'closed'],
    rejected: ['edit', 'closed'],
};

export function isValidSuiteTransition(from: SuiteStatus, to: SuiteStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalSuiteStatus(status: SuiteStatus): boolean {
    return VALID_TRANSITIONS[status].length === 0;
}
