import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the generated RBAC matrix into global scope first (auth-manager.js depends on it)
const rbacMatrixPath = path.resolve(__dirname, '../www/js/rbac-matrix.generated.js');
if (fs.existsSync(rbacMatrixPath)) {
    eval(fs.readFileSync(rbacMatrixPath, 'utf-8'));
}

// Load AuthManager into global scope via eval
const authManagerPath = path.resolve(__dirname, '../www/js/auth-manager.js');
if (fs.existsSync(authManagerPath)) {
    const src = fs.readFileSync(authManagerPath, 'utf-8');
    // Patch window.syncAdapter to avoid reference errors during load
    if (typeof window !== 'undefined' && !window.syncAdapter) {
        window.syncAdapter = { stop: async () => {}, start: async () => {} };
    }
    eval(src);
}

function makeUser(overrides = {}) {
    return {
        id: '1',
        nome: 'Test User',
        usuario: 'testuser',
        perfil: 'operador',
        ativo: true,
        ...overrides,
    };
}

describe('AuthManager — sessão', () => {
    let auth;

    beforeEach(() => {
        auth = new window.AuthManager();
        localStorage.clear();
    });

    afterEach(() => {
        auth.stopSessionHeartbeat();
        localStorage.clear();
    });

    it('isLoggedIn() retorna false quando não há usuário', () => {
        expect(auth.isLoggedIn()).toBe(false);
    });

    it('isLoggedIn() retorna true após definir currentUser', () => {
        auth.currentUser = makeUser();
        expect(auth.isLoggedIn()).toBe(true);
    });

    it('saveSession() persiste user no localStorage', async () => {
        const user = makeUser({ perfil: 'gerente' });
        await auth.saveSession(user);
        const raw = localStorage.getItem(auth.sessionKey);
        expect(raw).not.toBeNull();
        const session = JSON.parse(raw);
        expect(session.user.id).toBe('1');
        expect(session.user.perfil).toBe('gerente');
    });

    it('saveSession() define expiresAt no futuro', async () => {
        await auth.saveSession(makeUser());
        const session = JSON.parse(localStorage.getItem(auth.sessionKey));
        expect(new Date(session.expiresAt) > new Date()).toBe(true);
    });

    it('loadSession() restaura currentUser de sessão válida', async () => {
        const user = makeUser({ perfil: 'admin' });
        await auth.saveSession(user);
        const result = await auth.loadSession();
        expect(result).toBe(true);
        expect(auth.currentUser).not.toBeNull();
        expect(auth.currentUser.perfil).toBe('admin');
    });

    it('loadSession() rejeita sessão expirada e faz logout', async () => {
        const user = makeUser();
        // Salvar sessão já expirada
        const session = {
            user,
            loginAt: new Date(Date.now() - 10000).toISOString(),
            expiresAt: new Date(Date.now() - 5000).toISOString(),
        };
        localStorage.setItem(auth.sessionKey, JSON.stringify(session));

        const result = await auth.loadSession();
        expect(result).toBe(false);
        expect(auth.currentUser).toBeNull();
    });

    it('logout() limpa currentUser e localStorage', async () => {
        auth.currentUser = makeUser();
        await auth.saveSession(auth.currentUser);
        await auth.logout();
        expect(auth.currentUser).toBeNull();
        expect(localStorage.getItem(auth.sessionKey)).toBeNull();
    });
});

describe('AuthManager — perfis e permissões', () => {
    let auth;

    beforeEach(() => {
        auth = new window.AuthManager();
    });

    afterEach(() => {
        auth.stopSessionHeartbeat();
    });

    it('isAdmin() retorna true apenas para admin', () => {
        auth.currentUser = makeUser({ perfil: 'admin' });
        expect(auth.isAdmin()).toBe(true);
        auth.currentUser = makeUser({ perfil: 'gerente' });
        expect(auth.isAdmin()).toBe(false);
    });

    it('isManager() retorna true apenas para gerente', () => {
        auth.currentUser = makeUser({ perfil: 'gerente' });
        expect(auth.isManager()).toBe(true);
        auth.currentUser = makeUser({ perfil: 'operador' });
        expect(auth.isManager()).toBe(false);
    });

    it('isOperator() retorna true apenas para operador', () => {
        auth.currentUser = makeUser({ perfil: 'operador' });
        expect(auth.isOperator()).toBe(true);
        auth.currentUser = makeUser({ perfil: 'campo' });
        expect(auth.isOperator()).toBe(false);
    });

    it('hasPermission() retorna false sem usuário logado', () => {
        auth.currentUser = null;
        expect(auth.hasPermission('users.create')).toBe(false);
    });

    it('hasPermission() — admin tem tasks.reassign', () => {
        auth.currentUser = makeUser({ perfil: 'admin' });
        expect(auth.hasPermission('tasks.reassign')).toBe(true);
    });

    it('hasPermission() — gerente tem tasks.reassign', () => {
        auth.currentUser = makeUser({ perfil: 'gerente' });
        expect(auth.hasPermission('tasks.reassign')).toBe(true);
    });

    it('hasPermission() — encarregado tem tasks.reassign', () => {
        auth.currentUser = makeUser({ perfil: 'encarregado' });
        expect(auth.hasPermission('tasks.reassign')).toBe(true);
    });

    it('hasPermission() — operador NÃO tem tasks.reassign', () => {
        auth.currentUser = makeUser({ perfil: 'operador' });
        expect(auth.hasPermission('tasks.reassign')).toBe(false);
    });

    it('hasPermission() — campo NÃO tem tasks.reassign', () => {
        auth.currentUser = makeUser({ perfil: 'campo' });
        expect(auth.hasPermission('tasks.reassign')).toBe(false);
    });

    it('hasPermission() — coordenador NÃO tem tasks.reassign', () => {
        auth.currentUser = makeUser({ perfil: 'coordenador' });
        expect(auth.hasPermission('tasks.reassign')).toBe(false);
    });

    it('canEditUser() — admin pode editar qualquer perfil', () => {
        auth.currentUser = makeUser({ perfil: 'admin' });
        expect(auth.canEditUser(makeUser({ perfil: 'campo' }))).toBe(true);
        expect(auth.canEditUser(makeUser({ perfil: 'gerente' }))).toBe(true);
    });

    it('canEditUser() — gerente pode editar operador mas não gerente', () => {
        auth.currentUser = makeUser({ perfil: 'gerente' });
        expect(auth.canEditUser(makeUser({ perfil: 'operador' }))).toBe(true);
        expect(auth.canEditUser(makeUser({ id: '99', perfil: 'gerente' }))).toBe(false);
    });

    it('ROLE_HIERARCHY cobre os 6 perfis canônicos com campo === operador', () => {
        expect(Object.keys(window.AuthManager.ROLE_HIERARCHY).sort()).toEqual(
            ['admin', 'campo', 'coordenador', 'encarregado', 'gerente', 'operador'].sort()
        );
        expect(window.AuthManager.ROLE_HIERARCHY.campo).toBe(window.AuthManager.ROLE_HIERARCHY.operador);
    });

    it('hasPermission() nunca retorna true para roles ghost', () => {
        auth.currentUser = makeUser({ perfil: 'superadmin' });
        expect(auth.hasPermission('users.create')).toBe(false);
        expect(auth.hasPermission('system.sync')).toBe(false);
    });

    it('hasPermission() — coordenador e campo têm data.edit_own (gap corrigido)', () => {
        auth.currentUser = makeUser({ perfil: 'coordenador' });
        expect(auth.hasPermission('data.edit_own')).toBe(true);
        auth.currentUser = makeUser({ perfil: 'campo' });
        expect(auth.hasPermission('data.edit_own')).toBe(true);
    });
});
