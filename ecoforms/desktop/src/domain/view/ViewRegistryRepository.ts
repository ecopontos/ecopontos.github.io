import type { ViewRegistry } from './ViewRegistry';

export interface ViewRegistryRepository {
    findById(id: string): Promise<ViewRegistry | null>;
    findByModuleType(moduleType: string): Promise<ViewRegistry[]>;
    findByPerfil(perfil: string): Promise<ViewRegistry[]>;
    findActive(): Promise<ViewRegistry[]>;
    findAll(): Promise<ViewRegistry[]>;
    save(view: ViewRegistry): Promise<void>;
    delete(id: string): Promise<void>;
}