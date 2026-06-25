import { describe, it, expect } from 'vitest';
import { usePermissions } from '@/src/interface/hooks/catalog/auth';

describe('usePermissions - tasks.reassign', () => {
    it('should allow encarregado to have tasks.reassign permission', () => {
        const user = { id: 'u1', perfil: 'encarregado', formularios_permitidos: [] } as any;
        const perms = usePermissions(user);
        expect(perms.hasPermission('tasks.reassign')).toBe(true);
    });

    it('should allow gerente and admin to have tasks.reassign permission', () => {
        const admin = { id: 'a1', perfil: 'admin', formularios_permitidos: [] } as any;
        const gerente = { id: 'g1', perfil: 'gerente', formularios_permitidos: [] } as any;
        expect(usePermissions(admin).hasPermission('tasks.reassign')).toBe(true);
        expect(usePermissions(gerente).hasPermission('tasks.reassign')).toBe(true);
    });

    it('should deny operador from tasks.reassign', () => {
        const operador = { id: 'o1', perfil: 'operador', formularios_permitidos: [] } as any;
        expect(usePermissions(operador).hasPermission('tasks.reassign')).toBe(false);
    });
});
