import { describe, it, expect } from 'vitest';
import { PermissionManager } from '../www/js/core/PermissionManager.js';

describe('Encargado role', () => {
  it('should exist in PermissionManager with tasks:reassign permission', () => {
    const pm = new PermissionManager();
    expect(pm.roles.has('encarregado')).toBe(true);
    const role = pm.roles.get('encarregado');
    expect(role).toBeDefined();
    expect(role.permissions.has('tasks:reassign')).toBe(true);
  });
});
