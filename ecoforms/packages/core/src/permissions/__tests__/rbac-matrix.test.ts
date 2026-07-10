import { describe, it, expect } from 'vitest';
import { ROLE_HIERARCHY, PERMISSION_MATRIX, ROLE_METADATA, DATA_EDIT_OWN_TIME_WINDOWS } from '../rbac-matrix';

const ALL_ROLES = ['admin', 'gerente', 'coordenador', 'encarregado', 'operador', 'campo'];
const GHOST_ROLES = ['superadmin', 'manager', 'user', 'guest'];

describe('rbac-matrix — consistência canônica', () => {
  it('ROLE_HIERARCHY define exatamente os 6 perfis canônicos', () => {
    expect(Object.keys(ROLE_HIERARCHY).sort()).toEqual([...ALL_ROLES].sort());
  });

  it('campo e operador têm o mesmo nível hierárquico (4)', () => {
    expect(ROLE_HIERARCHY.campo).toBe(4);
    expect(ROLE_HIERARCHY.operador).toBe(4);
    expect(ROLE_HIERARCHY.campo).toBe(ROLE_HIERARCHY.operador);
  });

  it('nenhuma permissão contém ghost roles nem roles desconhecidos', () => {
    for (const [, entry] of Object.entries(PERMISSION_MATRIX)) {
      for (const role of entry.roles) {
        expect(GHOST_ROLES).not.toContain(role);
        expect(ALL_ROLES).toContain(role);
      }
    }
  });

  it('system.sync é restrito a admin e gerente', () => {
    expect(PERMISSION_MATRIX['system.sync'].roles.slice().sort()).toEqual(['admin', 'gerente']);
  });

  it('tasks.reassign inclui encarregado (comportamento atual preservado)', () => {
    expect(PERMISSION_MATRIX['tasks.reassign'].roles.slice().sort()).toEqual(['admin', 'encarregado', 'gerente']);
  });

  it('ROLE_METADATA cobre os 6 perfis canônicos', () => {
    expect(Object.keys(ROLE_METADATA).sort()).toEqual([...ALL_ROLES].sort());
  });

  it('DATA_EDIT_OWN_TIME_WINDOWS reflete coordenador=48h, operador/campo=24h, encarregado sem janela', () => {
    expect(DATA_EDIT_OWN_TIME_WINDOWS.coordenador).toBe(48);
    expect(DATA_EDIT_OWN_TIME_WINDOWS.operador).toBe(24);
    expect(DATA_EDIT_OWN_TIME_WINDOWS.campo).toBe(24);
    expect(DATA_EDIT_OWN_TIME_WINDOWS.encarregado).toBeUndefined();
  });

  it('PERMISSION_MATRIX tem exatamente 36 permissões (paridade com o seed Rust atual)', () => {
    expect(Object.keys(PERMISSION_MATRIX)).toHaveLength(36);
  });
});
