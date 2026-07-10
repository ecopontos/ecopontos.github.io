import type { SyncPort, SyncResult } from '../../application/ports/SyncPort';
import type { SqlitePort } from '../../application/ports/SqlitePort';
import type { OrgConfigService } from './OrgConfigService';
import type { TransportService } from './TransportService';
import type { InboundService } from './InboundService';

export class EventSyncAdapter implements SyncPort {
    private knownRoutingIds: string[] = [];

    constructor(
        private sqlite: SqlitePort,
        private transport: TransportService,
        private inbound: InboundService,
        private orgConfigService: OrgConfigService,
    ) {}

    setKnownRoutingIds(ids: string[]): void {
        this.knownRoutingIds = ids;
    }

    async ensureReady(): Promise<void> {
        // O EventSyncAdapter é construído já configurado — nada a pré-inicializar.
    }

    async syncAll(_options?: { forcePush?: boolean }): Promise<SyncResult> {
        const result: SyncResult = {
            success: true,            synced: {
                registro_formularios: 0,
                registro_dados: 0,
                pacotes_push: 0,
                pacotes_pull: 0,
                usuarios: 0,
                projects_push: 0,
                projects_pull: 0,
                tasks_push: 0,
                tasks_pull: 0,
                task_snaps_push: 0,
                ecoponto_state_push: 0,
            },
            errors: [],
        };

        try {
            const pushResult = await this.transport.pushPending();
            result.synced.tasks_push = pushResult.sent;
            if (pushResult.errors.length > 0) {
                result.errors.push(...pushResult.errors);
            }

            if (this.knownRoutingIds.length > 0) {
                const pullResult = await this.inbound.pull(this.knownRoutingIds);
                result.synced.tasks_pull = pullResult.processed;
                if (pullResult.errors.length > 0) {
                    result.errors.push(...pullResult.errors);
                }
            }

            // Limpeza periódica de eventos antigos já enviados
            await this.transport.purgeOldSentEvents(30);
        } catch (err) {
            result.success = false;
            result.errors.push(err instanceof Error ? err.message : String(err));
        }

        return result;
    }

    async pushTasks(): Promise<{ sent: number; failed: number; errors: string[] }> {
        return this.transport.pushPending();
    }

    async pullTasks(): Promise<void> {
        if (this.knownRoutingIds.length > 0) {
            await this.inbound.pull(this.knownRoutingIds);
        }
    }

    async getOfflineQueueSize(): Promise<number> {
        const rows = await this.sqlite.query<{ count: number }>(
            `SELECT COUNT(*) AS count FROM fila_eventos_sync WHERE situacao IN ('pending', 'failed')`,
        );
        return rows[0]?.count ?? 0;
    }

    async processOfflineQueue(): Promise<{ processed: number; failed: number }> {
        const result = await this.transport.pushPending();
        return { processed: result.sent, failed: result.failed };
    }

    stop(): void {
        this.transport.stop();
        this.inbound.stop();
    }

    async enqueueMutation(): Promise<void> {
        // não aplicável — use cases chamam transport.publish() diretamente
    }
}
