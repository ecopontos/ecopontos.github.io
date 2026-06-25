import type { ModuleRepository } from '../../domain/module/ModuleRepository';

export class PublishModuleUseCase {
  constructor(private readonly repo: ModuleRepository) {}

  async execute(moduleId: string): Promise<void> {
    const mod = await this.repo.findById(moduleId);
    if (!mod) throw new Error('Módulo não encontrado');
    if (mod.status === 'published') return;

    mod.status = 'published';
    mod.version += 1;
    mod.publicado_em = new Date().toISOString();
    mod.atualizado_em = new Date().toISOString();

    await this.repo.save(mod);
  }
}
