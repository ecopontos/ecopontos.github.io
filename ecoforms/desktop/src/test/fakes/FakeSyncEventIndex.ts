import type { SyncEventIndexPort, SyncEventIndexRow, PushEventParams } from 'ecoforms-core';

/**
 * Fake SyncEventIndexPort para testes — simula a tabela Postgres
 * `sync_event_index` (ADR-056 §8) em memória, com a mesma semântica das
 * RPCs `rpc_push_sync_event` (idempotente por id, atribui seq sequencial
 * por routing_id) e `rpc_pull_sync_events` (filtra por seq > sinceSeq,
 * ordenado ASC, paginado).
 */
export class FakeSyncEventIndex implements SyncEventIndexPort {
    private rows: SyncEventIndexRow[] = [];

    async pushEvent(params: PushEventParams): Promise<number> {
        const existing = this.rows.find(r => r.id === params.id);
        if (existing) return existing.seq;

        const maxSeq = this.rows
            .filter(r => r.routing_id === params.routingId)
            .reduce((m, r) => Math.max(m, r.seq), 0);
        const seq = maxSeq + 1;

        this.rows.push({
            id: params.id,
            routing_id: params.routingId,
            routing_type: params.routingType,
            seq,
            event_type: params.eventType,
            aggregate_type: params.aggregateType ?? null,
            aggregate_id: params.aggregateId ?? null,
            device_id: params.deviceId,
            checksum: params.checksum,
            prev_event_id: params.prevEventId ?? null,
            payload_enc: params.payloadEnc,
            created_at: new Date().toISOString(),
        });
        return seq;
    }

    async pullEvents(routingId: string, sinceSeq: number, limit = 50): Promise<SyncEventIndexRow[]> {
        return this.rows
            .filter(r => r.routing_id === routingId && r.seq > sinceSeq)
            .sort((a, b) => a.seq - b.seq)
            .slice(0, limit);
    }

    /** Insere uma row diretamente, com seq arbitrário — usado para simular gaps. */
    _seed(row: SyncEventIndexRow): void {
        this.rows.push(row);
    }

    /** Todas as rows armazenadas — útil para assertions. */
    _all(): SyncEventIndexRow[] {
        return this.rows;
    }
}
