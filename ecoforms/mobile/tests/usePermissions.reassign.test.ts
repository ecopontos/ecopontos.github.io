import { describe, it, expect } from 'vitest';
import { importUsePermissions } from './__helpers__/usePermissions.import';

describe('usePermissions - tasks.reassign (root)', () => {
    it('should allow encarregado to have tasks.reassign permission', async () => {
        const module = await importUsePermissions();
        const usePermissions = module.usePermissions;
        const user = { id: 'u1', perfil: 'encarregado', formularios_permitidos: [] } as any;
        const perms = usePermissions(user);
        expect(perms.hasPermission('tasks.reassign')).toBe(true);
    });

    it('should allow gerente and admin to have tasks.reassign permission', async () => {
        const module = await importUsePermissions();
        const usePermissions = module.usePermissions;
        const admin = { id: 'a1', perfil: 'admin', formularios_permitidos: [] } as any;
        const gerente = { id: 'g1', perfil: 'gerente', formularios_permitidos: [] } as any;
        expect(usePermissions(admin).hasPermission('tasks.reassign')).toBe(true);
        expect(usePermissions(gerente).hasPermission('tasks.reassign')).toBe(true);
    });

    it('should deny operador from tasks.reassign', async () => {
        const module = await importUsePermissions();
        const usePermissions = module.usePermissions;
        const operador = { id: 'o1', perfil: 'operador', formularios_permitidos: [] } as any;
        expect(usePermissions(operador).hasPermission('tasks.reassign')).toBe(false);
    });
});
