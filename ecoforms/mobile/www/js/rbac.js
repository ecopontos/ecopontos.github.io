/**
 * RBAC — Role-Based Access Control (Mobile)
 *
 * Hierarquia: admin(0) > gerente(1) > coordenador(2) > encarregado(3) > operador(4) > campo(5)
 * Quanto menor o nível, mais privilégios.
 */

const ROLES = {
    admin: 0,
    gerente: 1,
    coordenador: 2,
    encarregado: 3,
    operador: 4,
    campo: 5,
};

function _user() {
    try { return JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch { return null; }
}

function _roleLevel(user) {
    const perfil = (user?.perfil || user?.role || 'operador').toLowerCase();
    return ROLES[perfil] ?? 5;
}

export function getRole() {
    const u = _user();
    return (u?.perfil || u?.role || 'operador').toLowerCase();
}

export function getRoleLevel() {
    return _roleLevel(_user());
}

export function can(permission) {
    const level = getRoleLevel();

    const permissions = {
        manageUsers:        level <= 1, // admin, gerente
        viewDashboard:      level <= 2, // admin, gerente, coordenador
        acceptDemanda:      level <= 3, // admin, gerente, coordenador, encarregado
        approveSuite:       level <= 2, // admin, gerente, coordenador
        rejectSuite:        level <= 2,
        forwardSuite:       level <= 2,
        createTask:         level <= 3, // ... encarregado
        manageClients:      level <= 3,
        viewRoutes:         level <= 5, // todos
        registerColeta:     level <= 4, // ... operador
        registerForm:       level <= 5, // todos
        exportData:         level <= 2,
        viewMetrics:        level <= 2,
        viewModules:        level <= 5,
        manageSectors:      level <= 0, // admin only
    };

    return permissions[permission] ?? false;
}

export function canManage(role) {
    const myLevel = getRoleLevel();
    const targetLevel = ROLES[role] ?? 5;
    return myLevel < targetLevel;
}

export function isAdmin() {
    return getRoleLevel() === 0;
}

export function isGerente() {
    return getRoleLevel() <= 1;
}

export function profileLabel() {
    const role = getRole();
    const labels = {
        admin: 'Administrador',
        gerente: 'Gerente',
        coordenador: 'Coordenador',
        encarregado: 'Encarregado',
        operador: 'Operador',
        campo: 'Campo',
    };
    return labels[role] || role;
}

if (typeof window !== 'undefined') {
    window.rbac = { getRole, getRoleLevel, can, canManage, isAdmin, isGerente, profileLabel };
}
