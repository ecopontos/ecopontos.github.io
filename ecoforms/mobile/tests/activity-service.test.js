import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load ActivityService into global scope via eval (same pattern as auth-manager.test.js)
const activityServicePath = path.resolve(__dirname, '../www/js/services/ActivityService.js');
if (fs.existsSync(activityServicePath)) {
    const src = fs.readFileSync(activityServicePath, 'utf-8');
    // Patch global objects to avoid reference errors during load
    if (typeof window === 'undefined') {
        global.window = {};
    }
    if (typeof indexedDB === 'undefined') {
        global.indexedDB = { open: () => ({ onerror: null, onupgradeneeded: null, onsuccess: null }) };
    }
    if (typeof console === 'undefined') {
        global.console = { log: () => {}, warn: () => {}, error: () => {} };
    }
    eval(src);
}

describe('ActivityService — sem ghost roles', () => {
    let service;

    beforeEach(() => {
        // Create a fresh instance of the REAL ActivityService
        service = new window.ActivityService();
    });

    it('hasFormPermission concede acesso total apenas a admin/gerente (carregado do arquivo real)', () => {
        // Ghost roles (superadmin, manager) should NOT have access
        expect(service.hasFormPermission({ perfil: 'superadmin' }, 'form-1')).toBe(false);
        expect(service.hasFormPermission({ perfil: 'manager' }, 'form-1')).toBe(false);

        // Real roles (admin, gerente) SHOULD have access
        expect(service.hasFormPermission({ perfil: 'admin' }, 'form-1')).toBe(true);
        expect(service.hasFormPermission({ perfil: 'gerente' }, 'form-1')).toBe(true);
    });

    it('getTaskVisibilityDiagnostics não reconhece superadmin/manager como admin/gerente (carregado do arquivo real)', () => {
        // Ghost role (superadmin) should NOT be able to see the task
        const task = {
            id: 'task-1',
            status: 'a_fazer',
            atribuido_para: 'other',
            form_registry_id: null,
            arquivado: false,
            setor_id: null
        };
        const diag = service.getTaskVisibilityDiagnostics(task, {
            id: 'u1',
            perfil: 'superadmin',
            setores: []
        });
        expect(diag.visible).toBe(false);
    });
});
