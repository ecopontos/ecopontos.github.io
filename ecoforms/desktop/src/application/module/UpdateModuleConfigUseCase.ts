import type { ModuleRepository } from '../../domain/module/ModuleRepository';
import type { ModuleConfig, ModulePermissionConfig } from '../../domain/module/ModuleRegistry';

export interface UpdateModuleConfigInput {
  id: string;
  config?: ModuleConfig;
  permissions?: ModulePermissionConfig[];
  // metadados editáveis via UI admin
  name?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  prefix?: string;
  ordem?: number;
}

export class UpdateModuleConfigUseCase {
  constructor(private readonly repo: ModuleRepository) {}

  async execute(input: UpdateModuleConfigInput): Promise<void> {
    const mod = await this.repo.findById(input.id);
    if (!mod) {
      throw new Error(`Module not found: ${input.id}`);
    }

    const hasEditableChanges =
      input.config !== undefined ||
      input.permissions !== undefined ||
      input.name !== undefined ||
      input.description !== undefined ||
      input.icon !== undefined ||
      input.color !== undefined ||
      input.prefix !== undefined ||
      input.ordem !== undefined;

    if (input.config) mod.config = input.config;
    if (input.name !== undefined) mod.name = input.name;
    if (input.description !== undefined) mod.description = input.description;
    if (input.icon !== undefined) mod.icon = input.icon;
    if (input.color !== undefined) mod.color = input.color;
    if (input.prefix !== undefined) mod.prefix = input.prefix;
    if (input.ordem !== undefined) mod.ordem = input.ordem;

    if (hasEditableChanges) {
      mod.config_version = (mod.config_version ?? 1) + 1;
    }

    mod.atualizado_em = new Date().toISOString();
    await this.repo.save(mod);

    if (input.permissions) {
      await this.repo.setPermissions(input.id, input.permissions);
    }
  }
}