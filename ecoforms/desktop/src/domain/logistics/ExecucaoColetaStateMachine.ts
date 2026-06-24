/**
 * Máquina de estados para execução de coleta
 * Define transições válidas entre status de execuções
 */

export type ExecucaoColetaStatus =
    | 'agendada'
    | 'em_transito'
    | 'em_execucao'
    | 'concluida'
    | 'cancelada';

const TRANSICOES_VALIDAS: Record<ExecucaoColetaStatus, ExecucaoColetaStatus[]> = {
    agendada: ['em_transito', 'cancelada'],
    em_transito: ['em_execucao', 'cancelada'],
    em_execucao: ['concluida', 'cancelada'],
    concluida: [],
    cancelada: [],
};

export class ExecucaoColetaStateMachine {
    static podeTransitar(de: string, para: string): boolean {
        const validos = TRANSICOES_VALIDAS[de as ExecucaoColetaStatus] ?? [];
        return validos.includes(para as ExecucaoColetaStatus);
    }

    static validarTransicao(de: string, para: string): void {
        if (!this.podeTransitar(de, para)) {
            throw new Error(
                `Transição inválida: ${de} → ${para}. ` +
                `Transições válidas de "${de}": ${(TRANSICOES_VALIDAS[de as ExecucaoColetaStatus] ?? []).join(', ') || 'nenhuma'}`
            );
        }
    }

    static isTerminal(status: string): boolean {
        return status === 'concluida' || status === 'cancelada';
    }

    static getAllStatus(): ExecucaoColetaStatus[] {
        return ['agendada', 'em_transito', 'em_execucao', 'concluida', 'cancelada'];
    }

    static getTransitionsFrom(status: string): ExecucaoColetaStatus[] {
        return TRANSICOES_VALIDAS[status as ExecucaoColetaStatus] ?? [];
    }
}
