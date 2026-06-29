// Constantes de eventos de domínio — Ouvidoria/Manifestações
// Single source of truth: todos os emissores referenciam estas constantes.

// ── Manifestação (ciclo de vida) ──────────────────────────────────────────
export const ManifestacaoCriada = 'manifestacao.criada';
export const ManifestacaoStatusAtualizado = 'manifestacao.status_atualizado';
export const ManifestacaoEncerrada = 'manifestacao.encerrada';

// ── Competência ───────────────────────────────────────────────────────────
export const ManifestacaoCompetenciaVerificada = 'manifestacao.competencia_verificada';

// ── Classificação administrativa ──────────────────────────────────────────
export const ManifestacaoClassificada = 'manifestacao.classificada';

// ── Tramitação / Transferência ────────────────────────────────────────────
export const ManifestacaoTramitacaoRegistrada = 'manifestacao.tramitacao_registrada';
export const ManifestacaoTransferida = 'manifestacao.transferida';

// ── Resposta ──────────────────────────────────────────────────────────────
export const ManifestacaoRespostaRegistrada = 'manifestacao.resposta_registrada';
export const ManifestacaoRespostaFormatada = 'manifestacao.resposta_formatada';
export const ManifestacaoRespostaEnviada = 'manifestacao.resposta_enviada';

// ── Despacho ──────────────────────────────────────────────────────────────
export const ManifestacaoDespachoRegistrado = 'manifestacao.despacho_registrado';

// ── Prazos / Cobrança ─────────────────────────────────────────────────────
export const ManifestacaoPrazoAdicionado = 'manifestacao.prazo_adicionado';
export const PrazoVencido = 'prazo.vencido';
export const PrazoCobrancaEnviada = 'prazo.cobranca_enviada';

// ── Payloads ──────────────────────────────────────────────────────────────
export interface StatusAtualizadoPayload {
    manifestacaoId: string;
    status: string;
    responsavelId?: string;
}

export interface CompetenciaVerificadaPayload {
    manifestacaoId: string;
    competencia: 'compete' | 'nao_compete';
    motivo?: string;
    orgaoDestino?: string;
}

export interface ManifestacaoClassificadaPayload {
    manifestacaoId: string;
    subassuntoId?: string;
    subunidadeId?: string;
    programaOrcamentarioId?: string;
}

export interface ManifestacaoTransferidaPayload {
    manifestacaoId: string;
    deSetorId?: string;
    paraSetorId: string;
    tipoTramitacao: string;
}

export interface RespostaFormatadaPayload {
    respostaId: string;
    manifestacaoId: string;
    respostaFormatada: string;
    modeloId?: string;
    marcadaRespondida: boolean;
}

export interface RespostaEnviadaPayload {
    envioId: string;
    respostaId: string;
    manifestacaoId: string;
    canal: string;
    statusEnvio: string;
}

export interface PrazoVencidoPayload {
    prazoId: string;
    manifestacaoId: string;
    dataLimite: string;
}

export interface PrazoCobrancaEnviadaPayload {
    prazoId: string;
    manifestacaoId: string;
    usuarioIds: string[];
}
