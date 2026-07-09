import type { DataRegistryRepository } from '../../domain/data-registry/DataRegistryRepository';
import { parsePersistedJson } from '../json/jsonPersistence';

export class AggregateByTypeUseCase {
    constructor(private readonly repo: DataRegistryRepository) {}

    async execute(tipo: string): Promise<unknown[]> {
        const items = await this.repo.findByTipo(tipo);
        const result: unknown[] = [];
        for (const item of items) {
            const raw = item.conteudo;
            const content = typeof raw === 'string' ? parsePersistedJson(raw) : raw;
            if (content === null && typeof raw === 'string') {
                // Antes isto era `continue` silencioso — uma linha de seed com
                // conteudo texto puro sumia sem rastro. Loga para permitir diagnostico.
                console.warn(
                    `[AggregateByTypeUseCase] registro_dados ${item.id} (tipo="${tipo}")` +
                    ` com conteudo nao-JSON, descartado:`,
                    raw.length > 120 ? raw.slice(0, 120) + '…' : raw,
                );
                continue;
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
