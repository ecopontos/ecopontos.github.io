// ⚠️ ESPELHO de www/js/sync/InboundService.js
// Alterações aqui devem ser refletidas lá.
import type { CryptoLayer } from './CryptoLayer';
import type { SqlitePort } from '../../application/ports/SqlitePort';
import { buildChecksum, type EventEnvelope } from './EventEnvelope';
import { uuidv7, type SyncEventIndexPort } from 'ecoforms-core';

export type InboundHandler = (envelope: EventEnvelope) => Promise<void>;

export interface PollResult {
    processed: number;
    skipped: number;
    errors: string[];
    remaining: number;
}

const INBOUND_PAGE_SIZE = 50;
const APPLIED_PLACEHOLDER = 'sync_event_index';

export class InboundService {
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private handlers = new Map<string, InboundHandler>();

    constructor(
        private crypto: CryptoLayer,
        private db: SqlitePort,
        private index: SyncEventIndexPort,
        private localRoutingId: string,
    ) {}

    on(eventType: string, handler: InboundHandler): void {
        this.handlers.set(eventType, handler);
    }

    start(knownRoutingIds: string[], intervalMs = 45_000): () => void {
        this.pull(knownRoutingIds).catch(err => console.error('[InboundService] Initial pull error:', err));
        this.intervalId = setInterval(() => {
            this.pull(knownRoutingIds).catch(err => console.error('[InboundService] Poll error:', err));
        }, intervalMs);
        return () => this.stop();
    }

    stop(): void {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    async pull(knownRoutingIds: string[]): Promise<PollResult> {
        const result: PollResult = { processed: 0, skipped: 0, errors: [], remaining: 0 };

        for (const remoteRoutingId of knownRoutingIds) {
            if (remoteRoutingId === this.localRoutingId) continue;

            try {
                let localSeq = await this._getLocalSeq(remoteRoutingId);

                while (true) {
                    const rows = await this.index.pullEvents(remoteRoutingId, localSeq, INBOUND_PAGE_SIZE);
                    if (rows.length === 0) break;

                    let gapDetected = false;

                    for (const row of rows) {
                        try {
                            const alreadyApplied = await this._isApplied(row.id);
                            if (alreadyApplied) {
                                result.skipped++;
                                continue;
                            }

                            const envelope = await this.crypto.decryptJson<EventEnvelope>(row.payload_enc);
                            const expectedChecksum = await buildChecksum(envelope.data);
                            if (envelope.checksum && envelope.checksum !== expectedChecksum) {
                                result.errors.push(`${row.id}: checksum inválido — possível corrupção ou tampering`);
                                continue;
                            }

                            if (row.seq !== localSeq + 1) {
                                result.errors.push(`Gap de sequência de ${remoteRoutingId}: esperado ${localSeq + 1}, recebido ${row.seq}`);
                                await this._recordGap(remoteRoutingId, localSeq + 1);
                                gapDetected = true;
                                break;
                            }

                            await this._dispatch(envelope);
                            await this._updateLocalSeq(remoteRoutingId, row.seq, row.id);
                            await this._markApplied(envelope);

                            localSeq = row.seq;
                            result.processed++;
                        } catch (err) {
                            result.errors.push(`${row.id}: ${String(err)}`);
                        }
                    }

                    if (gapDetected || rows.length < INBOUND_PAGE_SIZE) break;
                }
            } catch (err) {
                result.errors.push(`${remoteRoutingId}: ${String(err)}`);
            }
        }

        return result;
    }

    private async _dispatch(envelope: EventEnvelope): Promise<void> {
        const handler = this.handlers.get(envelope.type);
        if (!handler) {
            console.warn(`[InboundService] Nenhum handler para '${envelope.type}' — ignorado`);
            return;
        }
        await handler(envelope);
    }

    private async _getLocalSeq(routingId: string): Promise<number> {
        const rows = await this.db.query<{ sequencia: number }>(
            'SELECT sequencia FROM manifesto_sync WHERE id_roteamento = ? LIMIT 1',
            [routingId],
        );
        return rows[0]?.sequencia ?? 0;
    }

    private async _updateLocalSeq(routingId: string, seq: number, lastEventId: string): Promise<void> {
        await this.db.execute(
            `INSERT INTO manifesto_sync (id_roteamento, sequencia, ultimo_id_evento, atualizado_em)
             VALUES (?, ?, ?, datetime('now'))
             ON CONFLICT(id_roteamento) DO UPDATE SET
               sequencia = excluded.sequencia,
               ultimo_id_evento = excluded.ultimo_id_evento,
               atualizado_em = datetime('now')`,
            [routingId, seq, lastEventId],
        );
    }

    private async _isApplied(envelopeId: string): Promise<boolean> {
        const rows = await this.db.query<{ e: number }>(
            'SELECT 1 AS e FROM log_eventos_aplicados WHERE envelope_id = ? LIMIT 1',
            [envelopeId],
        );
        return rows.length > 0;
    }

    private async _markApplied(envelope: EventEnvelope): Promise<void> {
        await this.db.execute(
            `INSERT OR IGNORE INTO log_eventos_aplicados
             (envelope_id, tipo_entidade, id_entidade, caminho_storage, dispositivo_origem)
             VALUES (?, ?, ?, ?, ?)`,
            [envelope.id, envelope.aggregate.type, envelope.aggregate.id, APPLIED_PLACEHOLDER, envelope.source.device_id],
        );
    }

    private async _recordGap(routingId: string, missingSeq: number): Promise<void> {
        try {
            await this.db.execute(
                `INSERT OR IGNORE INTO log_gaps_sync (id, id_roteamento, sequencia_faltante, situacao, detectado_em)
                 VALUES (?, ?, ?, 'pending', datetime('now'))`,
                [uuidv7(), routingId, missingSeq],
            );
        } catch {
            /* Tabela pode não existir em bancos legados — não quebrar o pull */
        }
    }
}
