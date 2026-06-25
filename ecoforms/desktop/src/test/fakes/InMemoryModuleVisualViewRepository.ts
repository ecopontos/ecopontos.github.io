import type { ModuleVisualViewRepository } from '../../domain/visual/ModuleVisualViewRepository';
import { ModuleVisualView } from '../../domain/visual/ModuleVisualView';

export class InMemoryModuleVisualViewRepository implements ModuleVisualViewRepository {
    private views = new Map<string, ModuleVisualView>();

    async findById(id: string): Promise<ModuleVisualView | null> {
        return this.views.get(id) ?? null;
    }

    async findByModuleId(moduleId: string): Promise<ModuleVisualView[]> {
        return [...this.views.values()].filter(v => v.module_id === moduleId);
    }

    async findByModuleIdAndType(moduleId: string, visualType: string): Promise<ModuleVisualView[]> {
        return [...this.views.values()].filter(v => v.module_id === moduleId && v.visual_type === visualType);
    }

    async findDefaultsByModuleId(moduleId: string): Promise<ModuleVisualView[]> {
        return [...this.views.values()].filter(v => v.module_id === moduleId && v.is_default);
    }

    async findPersonalByUserId(moduleId: string, userId: string): Promise<ModuleVisualView[]> {
        return [...this.views.values()].filter(v => v.module_id === moduleId && v.user_id === userId);
    }

    async findGlobalViews(moduleId: string): Promise<ModuleVisualView[]> {
        return [...this.views.values()].filter(v => v.module_id === moduleId && v.isGlobal());
    }

    async findByParentId(parentId: string): Promise<ModuleVisualView[]> {
        return [...this.views.values()].filter(v => v.parent_view_id === parentId);
    }

    async findAll(): Promise<ModuleVisualView[]> {
        return [...this.views.values()];
    }

    async save(view: ModuleVisualView): Promise<void> {
        this.views.set(view.id, view);
    }

    async delete(id: string): Promise<void> {
        this.views.delete(id);
    }

    async setDefault(viewId: string, moduleId: string, visualType: string): Promise<void> {
        for (const [id, v] of this.views) {
            if (v.module_id === moduleId && v.visual_type === visualType) {
                this.views.set(id, v);
            }
        }
        const view = this.views.get(viewId);
        if (view) {
            this.views.set(viewId, ModuleVisualView.fromProps({ ...view['props'], is_default: true }));
        }
    }
}
