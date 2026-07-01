export interface SyncResult {
    success: boolean;    synced: {
        registro_formularios: number;
        registro_dados: number;
        pacotes_push: number;
        pacotes_pull: number;
        usuarios: number;
        projects_push: number;
        projects_pull: number;
        tasks_push: number;
        tasks_pull: number;
        task_snaps_push: number;
        ecoponto_state_push: number;
    };
    errors: string[];
}

export interface SyncSnapshot {
    version: string;
    timestamp: string;
    device_id: string;
    origin_device: string;
    sync_type: 'incremental' | 'full';
    data: Record<string, unknown>;
    metadata: {
        checksum: string;
        record_count: Record<string, number>;
        compressed: boolean;
        file_size_bytes: number;
    };
}

export interface SyncPort {
    syncAll(options?: { forcePush?: boolean }): Promise<SyncResult>;
    pushTasks(): Promise<{ sent: number; failed: number; errors: string[] }>;
    pullTasks(): Promise<void>;
    getOfflineQueueSize(): Promise<number>;
    processOfflineQueue(): Promise<{ processed: number; failed: number }>;
}
