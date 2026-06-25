// Constantes de eventos de domínio — Ouvidoria/Manifestações

export const ManifestacaoStatusAtualizado = 'manifestacao.status_atualizado';
export const ManifestacaoCompetenciaVerificada = 'manifestacao.competencia_verificada';
export const ManifestacaoCriada = 'manifestacao.criada';
export const ManifestacaoEncerrada = 'manifestacao.encerrada';

export interface CompetenciaVerificadaPayload {
    manifestacaoId: string;
    competencia: 'compete' | 'nao_compete';
    motivo?: string;
    orgaoDestino?: string;
}

export interface StatusAtualizadoPayload {
    manifestacaoId: string;
    status: string;
    responsavelId?: string;
}
