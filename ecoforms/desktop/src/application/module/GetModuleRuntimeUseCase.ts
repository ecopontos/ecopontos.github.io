import type { ModuleRepository } from '../../domain/module/ModuleRepository';
import type { ModuleRuntimeDto } from '../../domain/module/ModuleRegistry';

export class GetModuleRuntimeUseCase {
  constructor(private readonly repo: ModuleRepository) {}

  async execute(slug: string, userProfile: string): Promise<ModuleRuntimeDto | null> {
    return this.repo.loadRuntimeDto(slug, userProfile);
  }
}
