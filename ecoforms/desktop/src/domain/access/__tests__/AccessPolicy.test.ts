import { describe, it, expect } from 'vitest';
import { ROLE_HIERARCHY } from 'ecoforms-core/permissions';
import { roleLevel, getSubordinatePerfis } from '../AccessPolicy';

describe('AccessPolicy — usa a hierarquia canônica do core', () => {
  it('roleLevel delega para ROLE_HIERARCHY do core', () => {
    expect(roleLevel('campo')).toBe(ROLE_HIERARCHY.campo);
    expect(roleLevel('operador')).toBe(ROLE_HIERARCHY.operador);
    expect(roleLevel('campo')).toBe(roleLevel('operador'));
  });

  it('getSubordinatePerfis(coordenador) inclui encarregado, operador e campo', () => {
    const subs = getSubordinatePerfis('coordenador').sort();
    expect(subs).toEqual(['campo', 'encarregado', 'operador'].sort());
  });
});
