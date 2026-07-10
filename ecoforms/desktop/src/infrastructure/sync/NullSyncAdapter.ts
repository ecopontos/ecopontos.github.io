import type { SyncPort, SyncResult } from '../../application/ports/SyncPort';

export class NullSyncAdapter implements SyncPort {
    async syncAll(_options?: { forcePush?: boolean }): Promise<SyncResult> {
        return {
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
    }

    async pushTasks(): Promise<{ sent: number; failed: number; errors: string[] }> {
        return { sent: 0, failed: 0, errors: [] };
    }

    async pullTasks(): Promise<void> {}

    async getOfflineQueueSize(): Promise<number> { return 0; }

    async processOfflineQueue(): Promise<{ processed: number; failed: number }> {
        return { processed: 0, failed: 0 };
    }

    async ensureReady(): Promise<void> {}

    setKnownRoutingIds(_ids: string[]): void {}
}
