import type { DataRegistryRepository } from '../../domain/data-registry/DataRegistryRepository';

export class CountByTypeUseCase {
    constructor(private readonly repo: DataRegistryRepository) {}

    async execute(): Promise<Map<string, number>> {
        const items = await this.repo.findAll();
        const counts = new Map<string, number>();
        for (const item of items) {
            counts.set(item.tipo, (counts.get(item.tipo) ?? 0) + 1);
        }
        return counts;
    }
}
