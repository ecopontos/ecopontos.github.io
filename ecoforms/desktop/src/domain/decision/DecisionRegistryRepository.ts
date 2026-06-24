import type { DecisionRegistry } from './DecisionRegistry';

export interface DecisionRegistryRepository {
    findById(id: string): Promise<DecisionRegistry | null>;
    findByTargetType(targetType: string): Promise<DecisionRegistry[]>;
    findByAction(action: string): Promise<DecisionRegistry[]>;
    findByPerfilAndTargetType(perfil: string, targetType: string): Promise<DecisionRegistry[]>;
    findActive(): Promise<DecisionRegistry[]>;
    findAll(): Promise<DecisionRegistry[]>;
    save(decision: DecisionRegistry): Promise<void>;
    delete(id: string): Promise<void>;
}