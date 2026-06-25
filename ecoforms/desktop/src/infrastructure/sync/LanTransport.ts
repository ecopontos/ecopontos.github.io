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

export class LanTransport {
    private pushDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    private handlers = new Map<string, LanEventHandler>();
    private pushing = false;

    constructor(
        private hubUrl: string,
        private deviceId: string,
        private db: SqlitePort,
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

            const response = await fetch(`${this.hubUrl}/api/sync/events`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Device-Id': this.deviceId,
                },
                body: JSON.stringify(events),
            });

            if (!response.ok) {
                const errText = await response.text();
                return { sent: 0, failed: rows.length, errors: [errText] };
            }

            const result = (await response.json()) as { accepted: number; rejected: number; errors: string[] };

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

                const response = await fetch(
                    `${this.hubUrl}/api/sync/events?since_seq=${sinceSeq}&routing_id=${routingId}&limit=100`,
                    {
                        headers: { 'X-Device-Id': this.deviceId },
                    },
                );

                if (!response.ok) continue;

                const events = (await response.json()) as LanEvent[];

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

    async uploadFile(anexoId: string, filePath: string): Promise<void> {
        const { invoke } = await import('@tauri-apps/api/core');
        const base64Content = await invoke<string>('lan_read_file', { path: filePath });
        const binary = Uint8Array.from(atob(base64Content), (c) => c.charCodeAt(0));

        const formData = new FormData();
        formData.append('id', anexoId);
        formData.append('file', new Blob([binary]));

        await fetch(`${this.hubUrl}/api/files`, {
            method: 'POST',
            headers: { 'X-Device-Id': this.deviceId },
            body: formData,
        });
    }

    async downloadFile(anexoId: string): Promise<Uint8Array> {
        const response = await fetch(`${this.hubUrl}/api/files/${anexoId}`, {
            headers: { 'X-Device-Id': this.deviceId },
        });
        if (!response.ok) throw new Error(`Download failed: ${response.status}`);
        const buffer = await response.arrayBuffer();
        return new Uint8Array(buffer);
    }
}
