/**
 * ADR-013 1.4 — Máquina de estados controlada para manifestações
 * Transições inválidas lançam erro de domínio.
 */

export type ManifestacaoStatus =
    | 'aberta'
    | 'em_analise'
    | 'em_atendimento'
    | 'respondida'
    | 'em_avaliacao'
    | 'devolvida'
    | 'encaminhado_sema'
    | 'cancelada'
    | 'encerrada';

const TRANSICOES_VALIDAS: Record<ManifestacaoStatus, ManifestacaoStatus[]> = {
    aberta:           ['em_analise', 'cancelada'],
    em_analise:       ['em_atendimento', 'encaminhado_sema', 'devolvida', 'cancelada'],
    em_atendimento:   ['respondida', 'devolvida'],
    respondida:       ['em_avaliacao', 'encerrada'],
    em_avaliacao:     ['encerrada', 'em_atendimento'],
    devolvida:        ['em_analise'],
    encaminhado_sema: [],
    cancelada:        [],
    encerrada:        [],
};

export class TransicaoInvalidaError extends Error {
    constructor(public readonly de: string, public readonly para: string) {
        super(`Transição de status inválida: '${de}' → '${para}'`);
        this.name = 'TransicaoInvalidaError';
    }
}

export class ManifestacaoStateMachine {
    static podeTransitar(de: string, para: string): boolean {
        const validos = TRANSICOES_VALIDAS[de as ManifestacaoStatus] ?? [];
        return validos.includes(para as ManifestacaoStatus);
    }

    static validarTransicao(de: string, para: string): void {
        if (!this.podeTransitar(de, para)) {
            throw new TransicaoInvalidaError(de, para);
        }
    }

    static transicoesPossiveis(de: string): ManifestacaoStatus[] {
        return TRANSICOES_VALIDAS[de as ManifestacaoStatus] ?? [];
    }

    static isTerminal(status: string): boolean {
        return status === 'cancelada' || status === 'encerrada' || status === 'encaminhado_sema';
    }
}
