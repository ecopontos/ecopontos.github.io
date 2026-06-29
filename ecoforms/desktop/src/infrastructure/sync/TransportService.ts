// ⚠️ ESPELHO de www/js/sync/TransportService.js
// Alterações aqui devem ser refletidas lá.
import type { CryptoLayer } from './CryptoLayer';
import type { SqlitePort } from '../../application/ports/SqlitePort';
import { createEnvelope, buildChecksum, type EcoFormsEventType } from './EventEnvelope';
import { pushEventToIndex, TRANSPORT_BATCH_SIZE, TRANSPORT_MAX_RETRIES, type SyncEventIndexPort } from 'ecoforms-core';

export interface PushResult {
    sent: number;
    failed: number;
    errors: string[];
}

export interface PublishParams {
    type: EcoFormsEventType | string;
    data: unknown;
    aggregate_type?: string;
    aggregate_id?: string;
    correlation_id?: string;
    causation_id?: string;
    stream_id?: string;
    prev_event_id?: string;
}

export class TransportService {
    static readonly BATCH_SIZE = TRANSPORT_BATCH_SIZE;
    static readonly MAX_RETRIES = TRANSPORT_MAX_RETRIES;

    private _pushing = false;

    constructor(
        private crypto: CryptoLayer,
        private db: SqlitePort,
        private index: SyncEventIndexPort,
        private routingId: string,
        private deviceId: string,
    ) {}

    // Enfileira um evento para envio. Chamado diretamente pelos use cases com dados completos.
    async publish(params: PublishParams): Promise<void> {
        const nextSeq = await this._nextOutboundSeq();
        const prevEventId = await this._lastSentEventId();

        const envelope = createEnvelope(
            {
                type: params.type,
                data: params.data,
                aggregate_type: params.aggregate_type,
                aggregate_id: params.aggregate_id,
                correlation_id: params.correlation_id,
                causation_id: params.causation_id,
                stream_id: params.stream_id,
                prev_event_id: prevEventId,
            },
            nextSeq,
            this.deviceId,
            this.routingId,
        );

        envelope.checksum = await buildChecksum(envelope.data);

        await this.db.execute(
            `INSERT INTO fila_eventos_sync
             (id, tipo, carga, tipo_agregado, id_agregado, sequencia, situacao, criado_em)
             VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`,
            [
                envelope.id,
                envelope.type,
                JSON.stringify(envelope),
                envelope.aggregate.type,
                envelope.aggregate.id,
                envelope.seq,
            ],
        );
    }

    // Drena a fila e envia para o sync_event_index (ADR-056 §8). Retorna métricas.
    async pushPending(): Promise<PushResult> {
        if (this._pushing) return { sent: 0, failed: 0, errors: ['Push já em andamento'] };
        this._pushing = true;
        try {
            return await this._doPush();
        } finally {
            this._pushing = false;
        }
    }

    // Alias mantido para compatibilidade com EventSyncAdapter.
    async retryPending(): Promise<number> {
        const result = await this.pushPending();
        return result.sent;
    }

    stop(): void {
        // sem timers ativos — o ciclo é controlado pelo EventSyncAdapter
    }

    // Remove eventos sent com mais de N dias para evitar crescimento indefinido da fila
    async purgeOldSentEvents(days = 30): Promise<number> {
        await this.db.execute(
            `DELETE FROM fila_eventos_sync
             WHERE situacao = 'sent'
               AND enviado_em < datetime('now', '-${Math.max(1, Math.round(days))} days')`,
        );
        // SQLite não retorna rows affected facilmente via execute genérica;
        // retornamos 0 como placeholder — o importante é a limpeza ter ocorrido.
        return 0;
    }

    private async _doPush(): Promise<PushResult> {
        const rows = await this.db.query<{
            id: string;
            seq: number;
            payload: string;
            tentativas: number;
        }>(
            `SELECT id, sequencia AS seq, carga AS payload, tentativas
             FROM fila_eventos_sync
             WHERE situacao IN ('pending', 'failed')
               AND tentativas < ?
             ORDER BY sequencia ASC
             LIMIT ?`,
            [TransportService.MAX_RETRIES, TransportService.BATCH_SIZE],
        );

        if (rows.length === 0) return { sent: 0, failed: 0, errors: [] };

        const result: PushResult = { sent: 0, failed: 0, errors: [] };

        for (const row of rows) {
            const envelope = JSON.parse(row.payload);
            const pushResult = await pushEventToIndex({
                envelope,
                crypto: this.crypto,
                index: this.index,
                deviceId: this.deviceId,
            });

            if (pushResult.success) {
                await this.db.execute(
                    "UPDATE fila_eventos_sync SET situacao = 'sent', enviado_em = datetime('now') WHERE id = ?",
                    [row.id],
                );

                result.sent++;
            } else {
                await this.db.execute(
                    `UPDATE fila_eventos_sync SET situacao = 'failed', tentativas = tentativas + 1 WHERE id = ?`,
                    [row.id],
                );
                result.failed++;
                result.errors.push(`seq ${row.seq}: ${pushResult.error}`);
                // continua processando os demais eventos do batch
            }
        }

        return result;
    }

    private async _nextOutboundSeq(): Promise<number> {
        const rows = await this.db.query<{ seq: number }>(
            `SELECT COALESCE(MAX(sequencia), 0) + 1 AS seq FROM fila_eventos_sync`,
        );
        return rows[0]?.seq ?? 1;
    }

    private async _lastSentEventId(): Promise<string | null> {
        const rows = await this.db.query<{ id: string }>(
            `SELECT id FROM fila_eventos_sync
             WHERE situacao = 'sent'
             ORDER BY sequencia DESC
             LIMIT 1`,
        );
        return rows[0]?.id ?? null;
    }
}
