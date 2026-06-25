import { describe, it, expect, vi } from 'vitest';
import { GetModuleRuntimeUseCase } from '@/src/application/module/GetModuleRuntimeUseCase';
import type { ModuleRepository } from '@/src/domain/module/ModuleRepository';
import type { ModuleRuntimeDto } from '@/src/domain/module/ModuleRegistry';

function makeMockRepo(result: ModuleRuntimeDto | null): ModuleRepository {
  return { loadRuntimeDto: vi.fn().mockResolvedValue(result) } as unknown as ModuleRepository;
}

const sampleModule: ModuleRuntimeDto = {
  id: 'mod-1',
  slug: 'teste',
  name: 'Módulo de Teste',
  description: 'Descrição do módulo',
  entity_type: 'teste',
  icon: '🧪',
  color: null,
  prefix: 'TEST',
  ordem: 1,
  status: 'published',
  version: 1,
  tipo: 'dynamic',
  route: null,
  grupo: null,
  permissions: { can_view: true, can_create: true, can_edit: false, can_approve: false, can_delete: false },
  forms: [{ form_id: 'f1', required: true, default: true, order: 1, schema: { title: 'Form 1' } }],
  data_catalogs: [{ catalog_id: 'cat1', required: false, items: [] }],
  views: [],
  decisions: [],
};

describe('GetModuleRuntimeUseCase', () => {
  it('retorna módulo quando encontrado', async () => {
    const repo = makeMockRepo(sampleModule);
    const uc = new GetModuleRuntimeUseCase(repo);
    const result = await uc.execute('teste', 'u1', 'admin');

    expect(result).not.toBeNull();
    expect(result!.name).toBe('Módulo de Teste');
    expect(result!.forms).toHaveLength(1);
    expect(result!.data_catalogs).toHaveLength(1);
    expect(result!.permissions.can_create).toBe(true);
    expect(repo.loadRuntimeDto).toHaveBeenCalledWith('teste', 'u1', 'admin');
  });

  it('retorna null quando módulo não existe', async () => {
    const repo = makeMockRepo(null);
    const uc = new GetModuleRuntimeUseCase(repo);
    const result = await uc.execute('inexistente', 'u1', 'admin');

    expect(result).toBeNull();
  });

  it('delega slug, userId e perfil ao repository', async () => {
    const repo = makeMockRepo(sampleModule);
    const uc = new GetModuleRuntimeUseCase(repo);
    await uc.execute('meu-modulo', 'user-42', 'coordenador');

    expect(repo.loadRuntimeDto).toHaveBeenCalledWith('meu-modulo', 'user-42', 'coordenador');
  });
});
