import { uuidv7 } from 'ecoforms-core';
import type { ModuleRepository } from '../../domain/module/ModuleRepository';
import type { ModuleRegistry, ModuleConfig, ModulePermissionConfig } from '../../domain/module/ModuleRegistry';

export interface CreateModuleInput {
  slug: string;
  name: string;
  description?: string;
  entity_type: string;
  icon?: string;
  color?: string;
  prefix?: string;
  ordem?: number;
  config?: ModuleConfig;
  permissions?: ModulePermissionConfig[];
}

export class CreateModuleUseCase {
  constructor(private readonly repo: ModuleRepository) {}

  async execute(input: CreateModuleInput): Promise<string> {
    const id = uuidv7();
    const prefix = input.prefix || input.name.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '');

    const mod: ModuleRegistry = {
      id,
      slug: input.slug,
      name: input.name,
      description: input.description || null,
      entity_type: input.entity_type,
      icon: input.icon || null,
      color: input.color || null,
      prefix,
      ordem: input.ordem ?? 999,
      status: 'draft',
      version: 1,
      config: input.config || {},
      suite_config: null,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
      publicado_em: null,
    };

    await this.repo.save(mod);

    if (input.permissions && input.permissions.length > 0) {
      await this.repo.setPermissions(id, input.permissions);
    }

    return id;
  }
}
