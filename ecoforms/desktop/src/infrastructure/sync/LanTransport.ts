import type { SqlitePort } from '../../application/ports/SqlitePort';

export interface LanPushResult {
    sent: number;
    failed: number;
    errors: string[];
}

export interface LanPollResult {
    processed: number;
    errors: string[];
}

interface LanEvent {
    id: string;
    tipo: string;
    carga: unknown;
    sequencia_lan: number;
    id_roteamento: string;
    dispositivo_origem: string;
    recebido_em: string;
}

export type LanEventHandler = (envelope: Record<string, unknown>) => Promise<void>;

interface HttpResponse {
    status: number;
    body: string;
}

async function lanHttpRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string,
): Promise<HttpResponse> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<HttpResponse>('lan_http_request', { url, method, headers, body: body ?? null });
}

async function lanHttpGetBytes(url: string, headers: Record<string, string>): Promise<Uint8Array> {
    const { invoke } = await import('@tauri-apps/api/core');
    const bytes = await invoke<number[]>('lan_http_get_bytes', { url, headers });
    return new Uint8Array(bytes);
}

export class LanTransport {
    private pushDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    private handlers = new Map<string, LanEventHandler>();
    private pushing = false;

    constructor(
        private hubUrl: string,
        private deviceId: string,
        private db: SqlitePort,
        private authToken?: string,
    ) {}

    registerHandler(eventType: string, handler: LanEventHandler): void {
        this.handlers.set(eventType, handler);
    }

    registerHandlers(handlerMap: Map<string, LanEventHandler>): void {
        for (const [type, handler] of handlerMap) {
            this.handlers.set(type, handler);
        }
    }

    triggerPush(): void {
        if (this.pushDebounceTimer) return;
        this.pushDebounceTimer = setTimeout(() => {
            this.pushDebounceTimer = null;
            this.pushPending().catch(() => {});
        }, 500);
    }

    private buildHeaders(extra: Record<string, string> = {}): Record<string, string> {
        const headers: Record<string, string> = {
            'X-Device-Id': this.deviceId,
            ...extra,
        };
        if (this.authToken) {
            headers['X-LAN-Token'] = this.authToken;
        }
        return headers;
    }

    async pushPending(): Promise<LanPushResult> {
        if (this.pushing) return { sent: 0, failed: 0, errors: [] };
        this.pushing = true;

        try {
            const rows = await this.db.query<{
                id: string;
                tipo: string;
                carga: string;
                tipo_agregado: string | null;
                id_agregado: string | null;
            }>(
                `SELECT id, tipo, carga, tipo_agregado, id_agregado
                 FROM fila_eventos_sync
                 WHERE situacao_lan IN ('pending', 'failed')
                 ORDER BY criado_em ASC
                 LIMIT 100`,
                [],
            );

            if (rows.length === 0) return { sent: 0, failed: 0, errors: [] };

            const events = rows.map((row) => ({
                id: row.id,
                tipo: row.tipo,
                carga: JSON.parse(row.carga),
                id_roteamento: '',
                dispositivo_origem: this.deviceId,
            }));

            const resp = await lanHttpRequest(
                `${this.hubUrl}/api/sync/events`,
                'POST',
                this.buildHeaders({ 'Content-Type': 'application/json' }),
                JSON.stringify(events),
            );

            if (resp.status < 200 || resp.status >= 300) {
                return { sent: 0, failed: rows.length, errors: [resp.body] };
            }

            const result = JSON.parse(resp.body) as { accepted: number; rejected: number; errors: string[] };

            const sentIds = rows.map((r) => r.id);
            for (const id of sentIds) {
                await this.db.execute(
                    `UPDATE fila_eventos_sync SET situacao_lan = 'sent' WHERE id = ?`,
                    [id],
                );
            }

            return { sent: result.accepted, failed: result.rejected, errors: result.errors };
        } catch (err) {
            return { sent: 0, failed: 0, errors: [String(err)] };
        } finally {
            this.pushing = false;
        }
    }

    async pullFromHub(routingIds: string[]): Promise<LanPollResult> {
        let totalProcessed = 0;
        const errors: string[] = [];

        for (const routingId of routingIds) {
            try {
                const cursorRows = await this.db.query<{ sequencia: number }>(
                    `SELECT sequencia FROM manifesto_sync WHERE id_roteamento = ?`,
                    [`lan:${routingId}`],
                );
                const sinceSeq = cursorRows[0]?.sequencia ?? 0;

                const resp = await lanHttpRequest(
                    `${this.hubUrl}/api/sync/events?since_seq=${sinceSeq}&routing_id=${routingId}&limit=100`,
                    'GET',
                    this.buildHeaders(),
                );

                if (resp.status < 200 || resp.status >= 300) continue;

                const events = JSON.parse(resp.body) as LanEvent[];

                for (const event of events) {
                    const applied = await this.db.query<{ envelope_id: string }>(
                        `SELECT envelope_id FROM log_eventos_aplicados WHERE envelope_id = ?`,
                        [event.id],
                    );
                    if (applied.length > 0) continue;

                    const envelope = typeof event.carga === 'string'
                        ? JSON.parse(event.carga)
                        : event.carga;
                    const eventType = (envelope as Record<string, unknown>).type as string ?? event.tipo;

                    const handler = this.handlers.get(eventType);
                    if (handler) {
                        try {
                            await handler(envelope as Record<string, unknown>);
                        } catch (e) {
                            errors.push(`Handler ${eventType}: ${String(e)}`);
                            continue;
                        }
                    }

                    await this.db.execute(
                        `INSERT OR IGNORE INTO log_eventos_aplicados
                         (envelope_id, tipo_entidade, id_entidade, caminho_storage, dispositivo_origem, aplicado_em)
                         VALUES (?, ?, ?, 'lan_transport', ?, datetime('now'))`,
                        [event.id, event.tipo, event.id, event.dispositivo_origem],
                    );

                    totalProcessed++;
                }

                if (events.length > 0) {
                    const maxSeq = events[events.length - 1].sequencia_lan;
                    await this.db.execute(
                        `INSERT OR REPLACE INTO manifesto_sync
                         (id_roteamento, sequencia, ultimo_id_evento, atualizado_em)
                         VALUES (?, ?, ?, datetime('now'))`,
                        [`lan:${routingId}`, maxSeq, events[events.length - 1].id],
                    );
                }
            } catch (e) {
                errors.push(`Pull ${routingId}: ${String(e)}`);
            }
        }

        return { processed: totalProcessed, errors };
    }

    async downloadFile(anexoId: string): Promise<Uint8Array> {
        return lanHttpGetBytes(
            `${this.hubUrl}/api/files/${anexoId}`,
            this.buildHeaders(),
        );
    }
}
