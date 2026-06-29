import { describe, expect, it } from 'vitest';
import type { ViewRegistryRepository } from '@/src/domain/view/ViewRegistryRepository';
import { ViewRegistry } from '../../../domain/view/ViewRegistry';
import {
    canEditModuleDashboard,
    CreateModuleDashboardUseCase,
    DeleteModuleDashboardUseCase,
    UpdateModuleDashboardWidgetsUseCase,
} from '../ViewUseCases';

class InMemoryViewRepo implements ViewRegistryRepository {
    items = new Map<string, ViewRegistry>();

    async findById(id: string) { return this.items.get(id) ?? null; }
    async findByModuleType(moduleType: string) { return [...this.items.values()].filter(v => v.moduleType === moduleType && v.ativo); }
    async findByPerfil(perfil: string) { return [...this.items.values()].filter(v => v.perfis.includes(perfil) && v.ativo); }
    async findActive() { return [...this.items.values()].filter(v => v.ativo); }
    async findAll() { return [...this.items.values()]; }
    async save(view: ViewRegistry) { this.items.set(view.id, view); }
    async delete(id: string) { this.items.delete(id); }
}

describe('Module dashboard use cases', () => {
    it('permite edição apenas para admin e gerente', () => {
        expect(canEditModuleDashboard('admin')).toBe(true);
        expect(canEditModuleDashboard('gerente')).toBe(true);
        expect(canEditModuleDashboard('operador')).toBe(false);
        expect(canEditModuleDashboard('campo')).toBe(false);
    });

    it('cria template global no tipo de módulo correto', async () => {
        const repo = new InMemoryViewRepo();
        const dashboard = await new CreateModuleDashboardUseCase(repo).execute({
            moduleType: 'inspecao',
            title: 'Inspeções',
            perfil: 'admin',
        });

        expect(dashboard.moduleType).toBe('inspecao');
        expect(dashboard.isTemplate).toBe(true);
        expect(dashboard.userId).toBeNull();
        expect(dashboard.ativo).toBe(true);
    });

    it('atualiza widgets declarativos e desativa dashboard', async () => {
        const repo = new InMemoryViewRepo();
        const created = await new CreateModuleDashboardUseCase(repo).execute({
            moduleType: 'inspecao',
            title: 'Inspeções',
            perfil: 'gerente',
        });

        const updated = await new UpdateModuleDashboardWidgetsUseCase(repo).execute({
            id: created.id,
            perfil: 'gerente',
            widgets: [{ title: 'Tabela', source: 'module_visual', visualType: 'table', config: { columns: ['status'] } }],
        });
        expect(updated.widgets).toHaveLength(1);
        expect((updated.widgets[0] as { source: string }).source).toBe('module_visual');

        await new DeleteModuleDashboardUseCase(repo).execute(created.id, 'admin');
        expect((await repo.findAll())[0].ativo).toBe(false);
    });

    it('bloqueia criação para perfis sem permissão', async () => {
        await expect(new CreateModuleDashboardUseCase(new InMemoryViewRepo()).execute({
            moduleType: 'inspecao',
            title: 'Inspeções',
            perfil: 'operador',
        })).rejects.toThrow(/permissão/);
    });
});
