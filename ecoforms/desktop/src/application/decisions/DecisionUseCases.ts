import type { DecisionRegistryRepository } from '@/src/domain/decision/DecisionRegistryRepository';
import type { DecisionRegistry } from '@/src/domain/decision/DecisionRegistry';

export class GetDecisionUseCase {
    constructor(private repo: DecisionRegistryRepository) {}

    async execute(id: string): Promise<DecisionRegistry | null> {
        return this.repo.findById(id);
    }
}

export class GetDecisionsByTargetTypeUseCase {
    constructor(private repo: DecisionRegistryRepository) {}

    async execute(targetType: string): Promise<DecisionRegistry[]> {
        return this.repo.findByTargetType(targetType);
    }
}

export class GetDecisionsByActionUseCase {
    constructor(private repo: DecisionRegistryRepository) {}

    async execute(action: string): Promise<DecisionRegistry[]> {
        return this.repo.findByAction(action);
    }
}

export class GetDecisionsForPerfilUseCase {
    constructor(private repo: DecisionRegistryRepository) {}

    async execute(perfil: string, targetType: string): Promise<DecisionRegistry[]> {
        return this.repo.findByPerfilAndTargetType(perfil, targetType);
    }
}

export class GetActiveDecisionsUseCase {
    constructor(private repo: DecisionRegistryRepository) {}

    async execute(): Promise<DecisionRegistry[]> {
        return this.repo.findActive();
    }
}