import type { ViewRegistryRepository } from '@/src/domain/view/ViewRegistryRepository';
import type { ViewRegistry } from '@/src/domain/view/ViewRegistry';

export class GetViewUseCase {
    constructor(private repo: ViewRegistryRepository) {}

    async execute(id: string): Promise<ViewRegistry | null> {
        return this.repo.findById(id);
    }
}

export class GetActiveViewsUseCase {
    constructor(private repo: ViewRegistryRepository) {}

    async execute(): Promise<ViewRegistry[]> {
        return this.repo.findActive();
    }
}

export class GetViewsByModuleUseCase {
    constructor(private repo: ViewRegistryRepository) {}

    async execute(moduleType: string): Promise<ViewRegistry[]> {
        return this.repo.findByModuleType(moduleType);
    }
}

export class GetViewsByPerfilUseCase {
    constructor(private repo: ViewRegistryRepository) {}

    async execute(perfil: string): Promise<ViewRegistry[]> {
        return this.repo.findByPerfil(perfil);
    }
}