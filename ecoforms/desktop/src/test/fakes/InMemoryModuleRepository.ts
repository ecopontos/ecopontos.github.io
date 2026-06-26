import type { ModuleRepository } from '@/domain/module/ModuleRepository';
import type { ModuleRegistry, ModulePermissionConfig } from '@/domain/module/ModuleRegistry';

export class InMemoryModuleRepository implements ModuleRepository {
    private modules = new Map<string, ModuleRegistry>();
    private permissions = new Map<string, ModulePermissionConfig[]>();

    async findById(id: string): Promise<ModuleRegistry | null> {
        return this.modules.get(id) ?? null;
    }

    async findBySlug(slug: string): Promise<ModuleRegistry | null> {
        return [...this.modules.values()].find(m => m.slug === slug) ?? null;
    }

    async findByEntityType(entityType: string): Promise<ModuleRegistry | null> {
        return [...this.modules.values()].find(m => m.entity_type === entityType) ?? null;
    }

    async findAll(status?: 'draft' | 'published' | 'archived'): Promise<ModuleRegistry[]> {
        const items = [...this.modules.values()];
        return status ? items.filter(m => m.status === status) : items;
    }

    async save(module: ModuleRegistry): Promise<void> {
        this.modules.set(module.id, { ...module });
    }

    async delete(id: string): Promise<void> {
        this.modules.delete(id);
    }

    async getPermissions(moduleId: string): Promise<ModulePermissionConfig[]> {
        return this.permissions.get(moduleId) ?? [];
    }

    async setPermissions(moduleId: string, perms: ModulePermissionConfig[]): Promise<void> {
        this.permissions.set(moduleId, perms.map(p => ({ ...p })));
    }

    async loadRuntimeDto(slug: string, userProfile: string): Promise<import('@/domain/module/ModuleRegistry').ModuleRuntimeDto | null> {
        const mod = await this.findBySlug(slug);
        if (!mod) return null;
        const perms = await this.getPermissions(mod.id);
        const userPerm = perms.find(p => p.profile === userProfile) ?? {
            can_view: false, can_create: false, can_edit: false, can_approve: false, can_delete: false,
        };
        const isAdmin = userProfile === 'admin';
        if (!isAdmin && !userPerm.can_view) {
            return null;
        }
        const effectivePerm = isAdmin
            ? {
                can_view: true,
                can_create: true,
                can_edit: true,
                can_approve: true,
                can_delete: true,
            }
            : userPerm;
        const views = (mod.config.views || []).map(v => ({
            view_id: v.view_id,
            context: v.context,
            order: v.order,
            definition: null,
        }));
        const decisions = (mod.config.decisions || []).map(d => ({
            decision_id: d.decision_id,
            definition: null,
        }));

        return {
            id: mod.id,
            slug: mod.slug,
            name: mod.name,
            description: mod.description,
            entity_type: mod.entity_type,
            icon: mod.icon,
            color: mod.color,
            prefix: mod.prefix,
            ordem: mod.ordem,
            status: mod.status,
            version: mod.version,
            permissions: effectivePerm,
            forms: [],
            data_catalogs: [],
            views,
            decisions,
        };
    }

    // Helpers para testes
    seedModule(module: ModuleRegistry): void {
        this.modules.set(module.id, module);
    }

    seedPermissions(moduleId: string, perms: ModulePermissionConfig[]): void {
        this.permissions.set(moduleId, perms);
    }
}