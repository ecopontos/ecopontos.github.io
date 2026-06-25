import { describe, it, expect } from 'vitest';
import { PermissionActionRegistry } from '../PermissionActionRegistry';

describe('PermissionActionRegistry — campo level regression (B5)', () => {
    let registry: PermissionActionRegistry;

    beforeEach(() => {
        registry = new PermissionActionRegistry();
    });

    it('campo deve ter nível 4 (igual operador)', () => {
        registry.register({
            action: 'VISUALIZAR',
            entity: 'form',
            requiredRoles: ['operador', 'campo'],
        });

        // Ambos devem ter acesso
        expect(registry.canExecute('VISUALIZAR', 'form', {
            userId: 'u1',
            userRole: 'operador',
            entity: 'form',
        })).toBe(true);

        expect(registry.canExecute('VISUALIZAR', 'form', {
            userId: 'u2',
            userRole: 'campo',
            entity: 'form',
        })).toBe(true);
    });

    it('campo subordinado ao gerente', () => {
        registry.register({
            action: 'VISUALIZAR',
            entity: 'data',
            requiredRoles: ['gerente'],
            scope: 'subordinates',
        });

        // gerente pode ver dados de campo (subordinado)
        expect(registry.canExecute('VISUALIZAR', 'data', {
            userId: 'u1',
            userRole: 'gerente',
            entity: 'data',
            ownerId: 'u2',
            ownerRole: 'campo',
        })).toBe(true);

        // campo NÃO pode ver dados de gerente (superior)
        expect(registry.canExecute('VISUALIZAR', 'data', {
            userId: 'u1',
            userRole: 'campo',
            entity: 'data',
            ownerId: 'u2',
            ownerRole: 'gerente',
        })).toBe(false);
    });

    it('operador e campo têm mesmo nível hierárquico (4)', () => {
        // Se campo tivesse nível 5, seria subordinado ao operador
        // Com nível 4, são iguais

        registry.register({
            action: 'EDITAR',
            entity: 'data',
            requiredRoles: ['operador'],
            scope: 'subordinates',
        });

        // operador com subordinates NÃO pode ver dados de campo (mesmo nível)
        expect(registry.canExecute('EDITAR', 'data', {
            userId: 'u1',
            userRole: 'operador',
            entity: 'data',
            ownerId: 'u2',
            ownerRole: 'campo',
        })).toBe(false);
    });

    it('todos os 6 roles estão registrados', () => {
        const roles = ['admin', 'gerente', 'coordenador', 'encarregado', 'operador', 'campo'];

        for (const role of roles) {
            registry.register({
                action: 'VISUALIZAR',
                entity: 'test',
                requiredRoles: [role],
            });

            expect(registry.canExecute('VISUALIZAR', 'test', {
                userId: 'u1',
                userRole: role,
                entity: 'test',
            })).toBe(true);
        }
    });

    it('admin nível 0 tem acesso máximo (todos os subordinates)', () => {
        registry.register({
            action: 'VISUALIZAR',
            entity: 'data',
            requiredRoles: ['admin'],
            scope: 'subordinates',
        });

        for (const role of ['gerente', 'coordenador', 'encarregado', 'operador', 'campo']) {
            expect(registry.canExecute('VISUALIZAR', 'data', {
                userId: 'u-admin',
                userRole: 'admin',
                entity: 'data',
                ownerId: `u-${role}`,
                ownerRole: role,
            })).toBe(true);
        }
    });
});
