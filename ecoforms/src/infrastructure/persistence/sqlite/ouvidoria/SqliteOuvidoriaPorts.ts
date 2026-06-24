/**
 * ADR-041 Gap 1 — Implementações SQLite dos ports de domínio da Ouvidoria.
 * Mantém o SQL na infraestrutura; o domínio (ProtocoloService, SlaCalculator) só vê interfaces.
 */
import type { SqlitePort } from '../../../../application/ports/SqlitePort';
import type { ProximoProtocoloPort } from '../../../../domain/ouvidoria/ProtocoloService';
import type { TipoManifestacaoSlaPort, TipoManifestacaoSLA } from '../../../../domain/ouvidoria/SlaCalculator';

export class SqliteProximoProtocoloAdapter implements ProximoProtocoloPort {
    constructor(private readonly db: SqlitePort) {}

    /**
     * Incremento atômico em statement único (RN-O08). O upsert
     * `ON CONFLICT ... DO UPDATE SET ultimo = ultimo + 1 RETURNING ultimo`
     * reserva o número sem janela read-modify-write; a conexão SQLite é
     * serializada por mutex no backend Rust, então não há colisão concorrente.
     */
    async proximo(ano: number): Promise<number> {
        const rows = await this.db.query<{ ultimo: number }>(
            `INSERT INTO protocolo_seq (ano, ultimo) VALUES (?, 1)
             ON CONFLICT(ano) DO UPDATE SET ultimo = protocolo_seq.ultimo + 1
             RETURNING ultimo`,
            [ano],
        );
        return rows[0].ultimo;
    }
}

export class SqliteTipoManifestacaoSlaAdapter implements TipoManifestacaoSlaPort {
    constructor(private readonly db: SqlitePort) {}

    async findSlaByTipo(tipoId: string): Promise<TipoManifestacaoSLA | null> {
        const rows = await this.db.query<TipoManifestacaoSLA>(
            'SELECT prazo_dias_corridos AS prazoDiasCorridos, prazo_urgente_dias AS prazoUrgenteDias FROM tipos_manifestacao WHERE id = ?',
            [tipoId],
        );
        return rows.length > 0 ? rows[0] : null;
    }
}
