import type { DataRegistryRepository } from '../../domain/data-registry/DataRegistryRepository';

export class AggregateByTypeUseCase {
    constructor(private readonly repo: DataRegistryRepository) {}

    async execute(tipo: string): Promise<unknown[]> {
        const items = await this.repo.findByTipo(tipo);
        const result: unknown[] = [];
        for (const item of items) {
            let content = item.conteudo;
            if (typeof content === 'string') {
                try { content = JSON.parse(content); } catch { continue; }
            }
            if (Array.isArray(content)) {
                result.push(...content);
            } else if (content != null) {
                result.push(content);
            }
        }
        return result;
    }
}
