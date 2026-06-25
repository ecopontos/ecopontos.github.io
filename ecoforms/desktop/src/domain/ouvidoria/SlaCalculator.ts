/**
 * ADR-013 1.2 — Cálculo automático de SLA (prazo_limite)
 * baseado em tipo de manifestação + prioridade.
 *
 * ADR-041 Gap 1: o domínio não consulta o banco. Os dados de SLA do tipo são
 * fornecidos por `TipoManifestacaoSlaPort` (implementação SQLite na infraestrutura).
 */
export interface TipoManifestacaoSLA {
    prazoDiasCorridos: number | null;
    prazoUrgenteDias: number | null;
}

export interface TipoManifestacaoSlaPort {
    findSlaByTipo(tipoId: string): Promise<TipoManifestacaoSLA | null>;
}

export class SlaCalculator {
    constructor(private readonly port: TipoManifestacaoSlaPort) {}

    async calcularPrazoLimite(tipoId: string, prioridade: string): Promise<string | null> {
        const sla = await this.port.findSlaByTipo(tipoId);
        if (!sla) return null;

        const { prazoDiasCorridos, prazoUrgenteDias } = sla;

        let dias = prazoDiasCorridos;
        if (prioridade === 'critico' && prazoUrgenteDias != null) {
            dias = prazoUrgenteDias;
        }

        if (dias == null) return null;

        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() + dias);
        return dataLimite.toISOString();
    }
}
