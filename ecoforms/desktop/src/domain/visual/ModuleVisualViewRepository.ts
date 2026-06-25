import type { ModuleVisualView } from './ModuleVisualView';

export interface ModuleVisualViewRepository {
    findById(id: string): Promise<ModuleVisualView | null>;
    findByModuleId(moduleId: string): Promise<ModuleVisualView[]>;
    findByModuleIdAndType(moduleId: string, visualType: string): Promise<ModuleVisualView[]>;
    findDefaultsByModuleId(moduleId: string): Promise<ModuleVisualView[]>;
    findPersonalByUserId(moduleId: string, userId: string): Promise<ModuleVisualView[]>;
    findGlobalViews(moduleId: string): Promise<ModuleVisualView[]>;
    findByParentId(parentId: string): Promise<ModuleVisualView[]>;
    findAll(): Promise<ModuleVisualView[]>;
    save(view: ModuleVisualView): Promise<void>;
    delete(id: string): Promise<void>;
    setDefault(viewId: string, moduleId: string, visualType: string): Promise<void>;
}
