import type { ModuleRegistry, ModuleRuntimeDto, ModulePermissionConfig } from './ModuleRegistry';

export interface ModuleRepository {
  findById(id: string): Promise<ModuleRegistry | null>;
  findBySlug(slug: string): Promise<ModuleRegistry | null>;
  findByEntityType(entityType: string): Promise<ModuleRegistry | null>;
  findAll(status?: 'draft' | 'published' | 'archived'): Promise<ModuleRegistry[]>;
  save(module: ModuleRegistry): Promise<void>;
  delete(id: string): Promise<void>;
  
  // Permissions
  getPermissions(moduleId: string): Promise<ModulePermissionConfig[]>;
  setPermissions(moduleId: string, permissions: ModulePermissionConfig[]): Promise<void>;
  
  // Runtime loader
  loadRuntimeDto(slug: string, userProfile: string): Promise<ModuleRuntimeDto | null>;
}
