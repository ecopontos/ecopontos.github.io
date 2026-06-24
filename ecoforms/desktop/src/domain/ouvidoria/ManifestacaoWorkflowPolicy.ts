import type { ManifestacaoStatus } from "./ManifestacaoStateMachine";

export interface WorkflowPolicy {
    isTerminal: boolean;
    canEdit: boolean;
    canTramitar: boolean;
    canResponder: boolean;
    permiteFase: {
        classificacao: boolean;
        resposta: boolean;
        avaliacao: boolean;
    };
}

export const MANIFESTACAO_POLICY: Record<ManifestacaoStatus, WorkflowPolicy> = {
    aberta: {
        isTerminal: false,
        canEdit: true,
        canTramitar: false,
        canResponder: false,
        permiteFase: { classificacao: false, resposta: false, avaliacao: false },
    },
    em_analise: {
        isTerminal: false,
        canEdit: true,
        canTramitar: true,
        canResponder: false,
        permiteFase: { classificacao: true, resposta: false, avaliacao: false },
    },
    em_atendimento: {
        isTerminal: false,
        canEdit: true,
        canTramitar: true,
        canResponder: true,
        permiteFase: { classificacao: false, resposta: true, avaliacao: false },
    },
    respondida: {
        isTerminal: false,
        canEdit: false,
        canTramitar: false,
        canResponder: false,
        permiteFase: { classificacao: false, resposta: false, avaliacao: true },
    },
    em_avaliacao: {
        isTerminal: false,
        canEdit: false,
        canTramitar: false,
        canResponder: false,
        permiteFase: { classificacao: false, resposta: false, avaliacao: true },
    },
    devolvida: {
        isTerminal: false,
        canEdit: true,
        canTramitar: true,
        canResponder: false,
        permiteFase: { classificacao: false, resposta: false, avaliacao: false },
    },
    encaminhado_sema: {
        isTerminal: true,
        canEdit: false,
        canTramitar: false,
        canResponder: false,
        permiteFase: { classificacao: false, resposta: false, avaliacao: false },
    },
    cancelada: {
        isTerminal: true,
        canEdit: false,
        canTramitar: false,
        canResponder: false,
        permiteFase: { classificacao: false, resposta: false, avaliacao: false },
    },
    encerrada: {
        isTerminal: true,
        canEdit: false,
        canTramitar: false,
        canResponder: false,
        permiteFase: { classificacao: false, resposta: false, avaliacao: false },
    },
};

export function resolvePolicy(status: string): WorkflowPolicy {
    const policy = MANIFESTACAO_POLICY[status as ManifestacaoStatus];
    if (!policy) throw new Error(`Status desconhecido: ${status}`);
    return policy;
}

export function isManifestacaoTerminal(status: string): boolean {
    return MANIFESTACAO_POLICY[status as ManifestacaoStatus]?.isTerminal ?? false;
}

export interface TramitacaoResolvivel {
    deSetorId?: string | null;
    deSetorNome?: string | null;
    criadoEm: string;
}

export function resolveSetorDevolucao(
    tramitacoes: TramitacaoResolvivel[],
    setorAtualId: string | null
): TramitacaoResolvivel | null {
    return tramitacoes
        .filter(t => t.deSetorId && t.deSetorId !== setorAtualId)
        .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())[0] ?? null;
}
