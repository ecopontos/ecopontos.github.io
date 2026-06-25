import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionActionRegistry } from '../PermissionActionRegistry';

describe('PermissionActionRegistry', () => {
    let registry: PermissionActionRegistry;

    beforeEach(() => {
        registry = new PermissionActionRegistry();
    });

    it('should allow admin to CRIAR client', () => {
        registry.register({
            action: 'CRIAR',
            entity: 'client',
            requiredRoles: ['admin'],
        });

        expect(registry.canExecute('CRIAR', 'client', {
            userId: 'u1',
            userRole: 'admin',
            entity: 'client',
        })).toBe(true);
    });

    it('should deny operador to CRIAR client', () => {
        registry.register({
            action: 'CRIAR',
            entity: 'client',
            requiredRoles: ['admin'],
        });

        expect(registry.canExecute('CRIAR', 'client', {
            userId: 'u1',
            userRole: 'operador',
            entity: 'client',
        })).toBe(false);
    });

    it('should respect scope=own', () => {
        registry.register({
            action: 'EDITAR',
            entity: 'data',
            requiredRoles: ['operador'],
            scope: 'own',
        });

        expect(registry.canExecute('EDITAR', 'data', {
            userId: 'u1',
            userRole: 'operador',
            entity: 'data',
            ownerId: 'u1',
        })).toBe(true);

        expect(registry.canExecute('EDITAR', 'data', {
            userId: 'u1',
            userRole: 'operador',
            entity: 'data',
            ownerId: 'u2',
        })).toBe(false);
    });

    it('should respect timeWindow', () => {
        registry.register({
            action: 'EDITAR',
            entity: 'data',
            requiredRoles: ['operador'],
            scope: 'own',
            timeWindow: 24,
        });

        const recent = new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(); // 2h ago
        const old = new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(); // 48h ago

        expect(registry.canExecute('EDITAR', 'data', {
            userId: 'u1',
            userRole: 'operador',
            entity: 'data',
            ownerId: 'u1',
            createdAt: recent,
        })).toBe(true);

        expect(registry.canExecute('EDITAR', 'data', {
            userId: 'u1',
            userRole: 'operador',
            entity: 'data',
            ownerId: 'u1',
            createdAt: old,
        })).toBe(false);
    });

    it('should respect enabledWhen', () => {
        registry.register({
            action: 'CRIAR',
            entity: 'user',
            requiredRoles: ['gerente'],
            enabledWhen: (ctx) => (ctx.data?.targetRole as string) !== 'admin',
        });

        expect(registry.canExecute('CRIAR', 'user', {
            userId: 'u1',
            userRole: 'gerente',
            entity: 'user',
            data: { targetRole: 'operador' },
        })).toBe(true);

        expect(registry.canExecute('CRIAR', 'user', {
            userId: 'u1',
            userRole: 'gerente',
            entity: 'user',
            data: { targetRole: 'admin' },
        })).toBe(false);
    });

    it('should return available actions', () => {
        registry.register({ action: 'VISUALIZAR', entity: 'client', requiredRoles: ['admin'] });
        registry.register({ action: 'CRIAR', entity: 'client', requiredRoles: ['admin'] });
        registry.register({ action: 'EXCLUIR', entity: 'client', requiredRoles: ['admin'] });

        const actions = registry.getAvailableActions('client', {
            userId: 'u1',
            userRole: 'admin',
            entity: 'client',
        });

        expect(actions.map(a => a.action)).toEqual(['VISUALIZAR', 'CRIAR', 'EXCLUIR']);
    });

    it('should clear entity', () => {
        registry.register({ action: 'CRIAR', entity: 'client', requiredRoles: ['admin'] });
        registry.clearEntity('client');

        expect(registry.canExecute('CRIAR', 'client', {
            userId: 'u1',
            userRole: 'admin',
            entity: 'client',
        })).toBe(false);
    });
});
