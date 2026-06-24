import type { SqlitePort } from '../ports/SqlitePort';
import { TIPO_MANIFESTACAO_UPSERT } from '../../infrastructure/persistence/sqlite/queries/manifestacoes';

/**
 * ADR-041 Gap 5 — Seed dos tipos padrão de manifestação.
 * Antes os dados estavam hardcoded no hook React (`useManifestacaoCatalogos`).
 * Seed é operação de infraestrutura/bootstrap — pertence à camada de aplicação, não à interface.
 */
export interface TipoManifestacaoSeed {
    id: string;
    nome: string;
    descricao: string;
    prazo_dias_corridos: number | null;
    prazo_urgente_dias: number | null;
}

export const DEFAULT_TIPOS_MANIFESTACAO: TipoManifestacaoSeed[] = [
    { id: 'reclamacao', nome: 'Reclamação', descricao: 'Insatisfação com serviço ou produto', prazo_dias_corridos: 30, prazo_urgente_dias: null },
    { id: 'sugestao', nome: 'Sugestão', descricao: 'Proposta de melhoria', prazo_dias_corridos: null, prazo_urgente_dias: null },
    { id: 'elogio', nome: 'Elogio', descricao: 'Reconhecimento positivo', prazo_dias_corridos: null, prazo_urgente_dias: null },
    { id: 'denuncia', nome: 'Denúncia', descricao: 'Comunicação de irregularidade', prazo_dias_corridos: 30, prazo_urgente_dias: 5 },
    { id: 'solicitacao', nome: 'Solicitação', descricao: 'Pedido de informação ou serviço', prazo_dias_corridos: 20, prazo_urgente_dias: null },
    { id: 'informacao', nome: 'Informação', descricao: 'Solicitação de informação geral', prazo_dias_corridos: null, prazo_urgente_dias: null },
];

export class SeedManifestacaoCatalogUseCase {
    constructor(private readonly db: SqlitePort) {}

    async execute(): Promise<void> {
        for (const tipo of DEFAULT_TIPOS_MANIFESTACAO) {
            await this.db.execute(
                TIPO_MANIFESTACAO_UPSERT.sql,
                [tipo.id, tipo.nome, tipo.descricao, tipo.prazo_dias_corridos, tipo.prazo_urgente_dias],
            );
        }
    }
}
