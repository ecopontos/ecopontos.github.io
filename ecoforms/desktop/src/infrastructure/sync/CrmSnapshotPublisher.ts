import type { LanFileStorage } from '../storage/LanFileStorage';
import type { SqlitePort } from '../../application/ports/SqlitePort';
import { loadCrmDataSource, getCrmDataSourceNames } from '../config/crm-datasources';

export class CrmSnapshotPublisher {
    constructor(
        private lan: LanFileStorage,
        private sqlite: SqlitePort,
    ) {}

    async publishAll(): Promise<void> {
        const names = getCrmDataSourceNames();
        await Promise.allSettled(names.map(n => this.publishOne(n)));
    }

    async publishOne(sourceName: string): Promise<void> {
        try {
            const rows = await loadCrmDataSource(sourceName);
            if (rows.length === 0) return;
            await this.lan.writeJson(`crm/${sourceName}.json`, rows);
        } catch (e) {
            console.warn(`[CrmSnapshotPublisher] Falha ao publicar ${sourceName}:`, e);
        }
    }
}
