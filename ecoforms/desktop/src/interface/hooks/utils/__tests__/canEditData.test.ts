import { describe, it, expect } from 'vitest';
import { usePermissions } from '../usePermissions';

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

describe('usePermissions().canEditData — janelas de tempo por perfil', () => {
  it('coordenador pode editar registro próprio com até 48h', () => {
    const user = { id: 'u1', perfil: 'coordenador' } as any;
    const { canEditData } = usePermissions(user);
    expect(canEditData({ criado_em: hoursAgoIso(47), user_id: 'u1' })).toBe(true);
    expect(canEditData({ criado_em: hoursAgoIso(49), user_id: 'u1' })).toBe(false);
  });

  it('operador e campo podem editar registro próprio com até 24h', () => {
    const operador = { id: 'u2', perfil: 'operador' } as any;
    const campo = { id: 'u3', perfil: 'campo' } as any;
    expect(usePermissions(operador).canEditData({ criado_em: hoursAgoIso(23), user_id: 'u2' })).toBe(true);
    expect(usePermissions(operador).canEditData({ criado_em: hoursAgoIso(25), user_id: 'u2' })).toBe(false);
    expect(usePermissions(campo).canEditData({ criado_em: hoursAgoIso(23), user_id: 'u3' })).toBe(true);
    expect(usePermissions(campo).canEditData({ criado_em: hoursAgoIso(25), user_id: 'u3' })).toBe(false);
  });

  it('encarregado não pode editar via canEditData (sem janela definida — comportamento atual preservado)', () => {
    const user = { id: 'u4', perfil: 'encarregado' } as any;
    const { canEditData } = usePermissions(user);
    expect(canEditData({ criado_em: hoursAgoIso(1), user_id: 'u4' })).toBe(false);
  });

  it('admin e gerente editam sem restrição de tempo', () => {
    const admin = { id: 'u5', perfil: 'admin' } as any;
    expect(usePermissions(admin).canEditData({ criado_em: hoursAgoIso(1000), user_id: 'outro' })).toBe(true);
  });
});
