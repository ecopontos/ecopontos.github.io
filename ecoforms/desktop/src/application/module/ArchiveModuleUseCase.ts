import type { ModuleRepository } from '../../domain/module/ModuleRepository';

/**
 * ADR-049 GAP-4 — Arquivamento local de módulo.
 * Antes só era possível arquivar via evento de sync remoto (`module.arquivado`).
 */
export class ArchiveModuleUseCase {
  constructor(private readonly repo: ModuleRepository) {}

  async execute(moduleId: string): Promise<void> {
    const mod = await this.repo.findById(moduleId);
    if (!mod) throw new Error('Módulo não encontrado');
    if (mod.status === 'archived') return;

    mod.status = 'archived';
    mod.atualizado_em = new Date().toISOString();

    await this.repo.save(mod);
  }
}
