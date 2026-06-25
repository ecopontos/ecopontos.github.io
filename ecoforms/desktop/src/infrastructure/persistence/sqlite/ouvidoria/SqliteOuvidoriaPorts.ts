/**
 * ADR-041 Gap 1 — Implementações SQLite dos ports de domínio da Ouvidoria.
 * Mantém o SQL na infraestrutura; o domínio (ProtocoloService, SlaCalculator) só vê interfaces.
 */
import type { SqlitePort } from '../../../../application/ports/SqlitePort';
import type { ProximoProtocoloPort } from '../../../../domain/ouvidoria/ProtocoloService';
import type { TipoManifestacaoSlaPort, TipoManifestacaoSLA } from '../../../../domain/ouvidoria/SlaCalculator';

export class SqliteProximoProtocoloAdapter implements ProximoProtocoloPort {
    constructor(private readonly db: SqlitePort) {}

    async getUltimo(ano: number): Promise<number | null> {
        const rows = await this.db.query<{ ultimo: number }>(
            'SELECT ultimo FROM protocolo_seq WHERE ano = ?',
            [ano],
        );
        return rows.length > 0 ? rows[0].ultimo : null;
    }

    async setUltimo(ano: number, valor: number): Promise<void> {
        const rows = await this.db.query<{ ano: number }>(
            'SELECT ano FROM protocolo_seq WHERE ano = ?',
            [ano],
        );
        if (rows.length === 0) {
            await this.db.execute('INSERT INTO protocolo_seq (ano, ultimo) VALUES (?, ?)', [ano, valor]);
        } else {
            await this.db.execute('UPDATE protocolo_seq SET ultimo = ? WHERE ano = ?', [valor, ano]);
        }
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
