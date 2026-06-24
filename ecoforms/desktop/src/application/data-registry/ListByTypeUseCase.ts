import type { DataRegistryRepository } from '../../domain/data-registry/DataRegistryRepository';
import type { DataRegistryDto } from './dto/DataRegistryDto';
import { toDataRegistryDto } from './mappers';

export class ListByTypeUseCase {
    constructor(private readonly repo: DataRegistryRepository) {}

    async execute(tipo: string): Promise<DataRegistryDto[]> {
        const items = await this.repo.findByTipo(tipo);
        return items.map(toDataRegistryDto);
    }
}
