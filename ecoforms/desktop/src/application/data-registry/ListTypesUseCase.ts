import type { DataRegistryRepository } from '../../domain/data-registry/DataRegistryRepository';

export class ListTypesUseCase {
    constructor(private readonly repo: DataRegistryRepository) {}

    async execute(): Promise<string[]> {
        return this.repo.findAllTypes();
    }
}
