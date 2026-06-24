/**
 * SyncEventIndexCore — lógica compartilhada de push/pull de eventos contra
 * a tabela Postgres `sync_event_index` (ADR-056 §8), via RPCs
 * `rpc_push_sync_event` / `rpc_pull_sync_events`.
 *
 * Substitui o transporte baseado em Manifest + arquivos `.enc` no Storage.
 * Cada plataforma injeta seu cliente Supabase (qualquer objeto com `.rpc()`).
 */

import { TRANSPORT_MAX_RETRIES } from './TransportCore.js';
import type { EventEnvelope } from './EventEnvelope.js';

/** Codifica bytes para o formato hex do Postgres BYTEA: '\x' + hex. */
export function bytesToPgHex(bytes: Uint8Array): string {
    let hex = '\\x';
    for (const b of bytes) hex += b.toString(16).padStart(2, '0');
    return hex;
}

/** Decodifica uma string hex do Postgres BYTEA ('\x...' ou sem prefixo) de volta para bytes. */
export function pgHexToBytes(hex: string): Uint8Array {
    const clean = hex.startsWith('\\x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
    }
    return bytes;
}

export interface SyncEventIndexRow {
    id: string;
    routing_id: string;
    routing_type: string;
    seq: number;
    event_type: string;
    aggregate_type: string | null;
    aggregate_id: string | null;
    device_id: string;
    checksum: string;
    prev_event_id: string | null;
    payload_enc: Uint8Array;
    created_at: string;
}

export interface PushEventParams {
    id: string;
    routingId: string;
    routingType: string;
    eventType: string;
    aggregateType?: string | null;
    aggregateId?: string | null;
    deviceId: string;
    checksum: string;
    prevEventId?: string | null;
    payloadEnc: Uint8Array;
}

export interface SyncEventIndexPort {
    /** Envia um evento e retorna o seq atribuído pelo servidor (idempotente por id). */
    pushEvent(params: PushEventParams): Promise<number>;
    /** Lista eventos de um routing_id com seq > sinceSeq, ordenados por seq ASC. */
    pullEvents(routingId: string, sinceSeq: number, limit?: number): Promise<SyncEventIndexRow[]>;
}

export interface SupabaseRpcClient {
    rpc(fn: string, params: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
}

const PULL_DEFAULT_LIMIT = 50;

/** Cria um SyncEventIndexPort backed pelas RPCs rpc_push_sync_event/rpc_pull_sync_events. */
export function createSupabaseSyncEventIndex(client: SupabaseRpcClient): SyncEventIndexPort {
    return {
        async pushEvent(params: PushEventParams): Promise<number> {
            const { data, error } = await client.rpc('rpc_push_sync_event', {
                p_id: params.id,
                p_routing_id: params.routingId,
                p_routing_type: params.routingType,
                p_event_type: params.eventType,
                p_aggregate_type: params.aggregateType ?? null,
                p_aggregate_id: params.aggregateId ?? null,
                p_device_id: params.deviceId,
                p_checksum: params.checksum,
                p_prev_event_id: params.prevEventId ?? null,
                p_payload_enc: bytesToPgHex(params.payloadEnc),
            });
            if (error) throw new Error(error.message);
            return Number(data);
        },

        async pullEvents(routingId: string, sinceSeq: number, limit = PULL_DEFAULT_LIMIT): Promise<SyncEventIndexRow[]> {
            const { data, error } = await client.rpc('rpc_pull_sync_events', {
                p_routing_id: routingId,
                p_since_seq: sinceSeq,
                p_limit: limit,
            });
            if (error) throw new Error(error.message);
            return ((data ?? []) as Array<Omit<SyncEventIndexRow, 'payload_enc'> & { payload_enc: string }>).map(row => ({
                ...row,
                payload_enc: pgHexToBytes(row.payload_enc),
            }));
        },
    };
}

export interface PushToIndexParams {
    envelope: EventEnvelope;
    crypto: { encryptJson(obj: unknown): Promise<Uint8Array> };
    index: SyncEventIndexPort;
    deviceId: string;
    maxRetries?: number;
}

export interface PushToIndexResult {
    success: boolean;
    seq?: number;
    error?: string;
}

/**
 * Pipeline completa de envio de um evento: encrypt → index.pushEvent (com retry).
 * routing_id/routing_type são lidos do envelope (envelope.source).
 */
export async function pushEventToIndex(params: PushToIndexParams): Promise<PushToIndexResult> {
    const { envelope, crypto, index, deviceId } = params;
    const maxRetries = params.maxRetries ?? TRANSPORT_MAX_RETRIES;

    let lastErr: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const blob = await crypto.encryptJson(envelope);
            const seq = await index.pushEvent({
                id: envelope.id,
                routingId: envelope.source.routing_id,
                routingType: envelope.source.routing_type,
                eventType: envelope.type,
                aggregateType: envelope.aggregate?.type,
                aggregateId: envelope.aggregate?.id,
                deviceId,
                checksum: envelope.checksum,
                prevEventId: envelope.prev_event_id,
                payloadEnc: blob,
            });
            return { success: true, seq };
        } catch (err) {
            lastErr = err;
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 300 * Math.pow(2, attempt)));
            }
        }
    }

    return { success: false, error: String(lastErr) };
}
