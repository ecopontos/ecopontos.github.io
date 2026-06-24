import { DataRegistryItem } from '../../domain/data-registry/DataRegistryItem';
import type { DataRegistryRepository } from '../../domain/data-registry/DataRegistryRepository';
import type { ClockPort } from '../ports/ClockPort';

export interface BulkInsertItem {
    chave: string;
    conteudo: unknown;
}

export interface BulkInsertResult {
    inserted: number;
    updated: number;
    errors: string[];
}

export class BulkInsertDataRegistryUseCase {
    constructor(
        private readonly repo: DataRegistryRepository,
        private readonly clock: ClockPort,
    ) {}

    async execute(tipo: string, items: BulkInsertItem[]): Promise<BulkInsertResult> {
        let inserted = 0;
        let updated = 0;
        const errors: string[] = [];
        const now = this.clock.nowIso();

        for (const item of items) {
            try {
                const existing = await this.repo.findById(item.chave);
                const entity = DataRegistryItem.fromProps({
                    id: item.chave,
                    tipo,
                    conteudo: item.conteudo,
                    criadoEm: existing ? undefined : now,
                    atualizadoEm: now,
                });
                await this.repo.save(entity);
                if (existing) { updated++; } else { inserted++; }
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                errors.push(`${item.chave}: ${msg}`);
            }
        }

        return { inserted, updated, errors };
    }
}
