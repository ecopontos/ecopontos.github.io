import type { ModuleRepository } from '../../domain/module/ModuleRepository';
import type { ModuleRegistry } from '../../domain/module/ModuleRegistry';

export class ListModulesUseCase {
  constructor(private readonly repo: ModuleRepository) {}

  async execute(status?: 'draft' | 'published' | 'archived'): Promise<ModuleRegistry[]> {
    return this.repo.findAll(status);
  }
}
