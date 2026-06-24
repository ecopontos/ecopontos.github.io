/**
 * PermissionManager - Módulo puro para gestão de permissões
 * Sem dependências de UI, Alpine ou DOM
 * 
 * Responsável por:
 * - Gerenciar permissões baseadas em roles/usuários
 * - Validar acesso a recursos
 * - Controlar hierarquia de permissões
 * - Suportar permissões dinâmicas e condicionais
 * 
 * @example
 * const permManager = new PermissionManager();
 * 
 * permManager.addRole('admin', ['*']);
 * permManager.addRole('user', ['forms:read', 'forms:create']);
 * 
 * if (permManager.can('forms:delete', user)) {
 *   // Permitir ação
 * }
 */

import { eventBus } from './EventEmitter.js';

export class PermissionManager {
    constructor(options = {}) {
        this.options = {
            strictMode: false, // Se true, nega por padrão quando permissão não definida
            hierarchyEnabled: true,
            cacheEnabled: true,
            cacheTTL: 60000, // 1 minuto
            ...options
        };

        this.roles = new Map();
        this.userPermissions = new Map();
        this.cache = new Map();
        this.customCheckers = new Map();
        
        this.initializeDefaultRoles();
    }

    /**
     * Inicializa roles padrão do sistema
     */
    initializeDefaultRoles() {
        // Super Admin - acesso total
        this.addRole('superadmin', ['*'], {
            description: 'Acesso total ao sistema',
            hierarchy: 100
        });

        // Admin - maioria das operações
        this.addRole('admin', [
            'forms:*',
            'users:read',
            'users:update',
            'reports:*',
            'settings:read'
        ], {
            description: 'Administrador do sistema',
            hierarchy: 90
        });

        // Manager - operações de gestão limitadas
        this.addRole('manager', [
            'forms:read',
            'forms:create',
            'forms:update',
            'reports:read',
            'reports:create'
        ], {
            description: 'Gestor de formulários',
            hierarchy: 70
        });

        // Encargado - permissão específica para reatribuir tarefas
        this.addRole('encarregado', [
            'tasks:reassign'
        ], {
            description: 'Responsável por reatribuir tarefas',
            hierarchy: 60
        });

        // User - operações básicas
        this.addRole('user', [
            'forms:read',
            'forms:create',
            'reports:read'
        ], {
            description: 'Usuário padrão',
            hierarchy: 50
        });

        // Guest - apenas leitura
        this.addRole('guest', [
            'forms:read'
        ], {
            description: 'Visitante (somente leitura)',
            hierarchy: 10
        });
    }

    /**
     * Adiciona ou atualiza uma role
     * @param {string} roleName - Nome da role
     * @param {string[]} permissions - Array de permissões
     * @param {object} metadata - Metadados da role
     */
    addRole(roleName, permissions, metadata = {}) {
        this.roles.set(roleName, {
            permissions: new Set(permissions),
            metadata: {
                description: '',
                hierarchy: 50,
                createdAt: Date.now(),
                ...metadata
            }
        });

        this.clearCache();
        eventBus.emit('roleAdded', { roleName, permissions, metadata });

        console.log(`✅ Role "${roleName}" adicionada com ${permissions.length} permissões`);
    }

    /**
     * Remove uma role
     * @param {string} roleName - Nome da role
     */
    removeRole(roleName) {
        if (this.roles.has(roleName)) {
            this.roles.delete(roleName);
            this.clearCache();
            eventBus.emit('roleRemoved', { roleName });
            return true;
        }
        return false;
    }

    /**
     * Atribui role a um usuário
     * @param {string} userId - ID do usuário
     * @param {string} roleName - Nome da role
     */
    assignRole(userId, roleName) {
        if (!this.roles.has(roleName)) {
            throw new Error(`Role "${roleName}" não existe`);
        }

        if (!this.userPermissions.has(userId)) {
            this.userPermissions.set(userId, {
                roles: new Set(),
                customPermissions: new Set(),
                deniedPermissions: new Set()
            });
        }

        const user = this.userPermissions.get(userId);
        user.roles.add(roleName);

        this.clearCacheForUser(userId);
        eventBus.emit('roleAssigned', { userId, roleName });

        console.log(`✅ Role "${roleName}" atribuída ao usuário ${userId}`);
    }

    /**
     * Remove role de um usuário
     * @param {string} userId - ID do usuário
     * @param {string} roleName - Nome da role
     */
    removeRoleFromUser(userId, roleName) {
        const user = this.userPermissions.get(userId);
        if (user && user.roles.has(roleName)) {
            user.roles.delete(roleName);
            this.clearCacheForUser(userId);
            eventBus.emit('roleRemoved', { userId, roleName });
            return true;
        }
        return false;
    }

    /**
     * Adiciona permissão customizada a um usuário
     * @param {string} userId - ID do usuário
     * @param {string} permission - Permissão
     */
    grantPermission(userId, permission) {
        if (!this.userPermissions.has(userId)) {
            this.userPermissions.set(userId, {
                roles: new Set(),
                customPermissions: new Set(),
                deniedPermissions: new Set()
            });
        }

        const user = this.userPermissions.get(userId);
        user.customPermissions.add(permission);
        user.deniedPermissions.delete(permission); // Remover negação se existir

        this.clearCacheForUser(userId);
        eventBus.emit('permissionGranted', { userId, permission });
    }

    /**
     * Remove permissão de um usuário
     * @param {string} userId - ID do usuário
     * @param {string} permission - Permissão
     */
    revokePermission(userId, permission) {
        const user = this.userPermissions.get(userId);
        if (user) {
            user.customPermissions.delete(permission);
            this.clearCacheForUser(userId);
            eventBus.emit('permissionRevoked', { userId, permission });
        }
    }

    /**
     * Nega explicitamente uma permissão (sobrescreve grants)
     * @param {string} userId - ID do usuário
     * @param {string} permission - Permissão a negar
     */
    denyPermission(userId, permission) {
        if (!this.userPermissions.has(userId)) {
            this.userPermissions.set(userId, {
                roles: new Set(),
                customPermissions: new Set(),
                deniedPermissions: new Set()
            });
        }

        const user = this.userPermissions.get(userId);
        user.deniedPermissions.add(permission);
        user.customPermissions.delete(permission); // Remover grant se existir

        this.clearCacheForUser(userId);
        eventBus.emit('permissionDenied', { userId, permission });
    }

    /**
     * Verifica se usuário tem permissão
     * @param {string} userId - ID do usuário ou objeto usuário
     * @param {string} permission - Permissão a verificar (ex: 'forms:delete')
     * @param {object} context - Contexto adicional para validação condicional
     * @returns {boolean} - true se tem permissão
     */
    can(userId, permission, context = {}) {
        // Suportar objeto usuário
        if (typeof userId === 'object' && userId.id) {
            context.user = userId;
            userId = userId.id;
        }

        // Verificar cache
        const cacheKey = `${userId}:${permission}`;
        if (this.options.cacheEnabled && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.options.cacheTTL) {
                return cached.result;
            }
        }

        // Verificar negação explícita (prioridade máxima)
        const user = this.userPermissions.get(userId);
        if (user && this.hasExplicitDenial(user, permission)) {
            return this.cacheResult(cacheKey, false);
        }

        // Verificar permissão customizada
        if (user && this.hasCustomPermission(user, permission)) {
            return this.cacheResult(cacheKey, true);
        }

        // Verificar permissões das roles
        if (user && this.hasRolePermission(user, permission)) {
            return this.cacheResult(cacheKey, true);
        }

        // Verificar checkers customizados
        if (this.hasCustomChecker(permission)) {
            const result = this.runCustomChecker(permission, userId, context);
            return this.cacheResult(cacheKey, result);
        }

        // Modo strict: negar por padrão se não definido
        return this.cacheResult(cacheKey, !this.options.strictMode);
    }

    /**
     * Verifica se usuário NÃO tem permissão
     */
    cannot(userId, permission, context = {}) {
        return !this.can(userId, permission, context);
    }

    /**
     * Verifica se usuário tem TODAS as permissões
     * @param {string} userId - ID do usuário
     * @param {string[]} permissions - Array de permissões
     * @param {object} context - Contexto adicional
     * @returns {boolean} - true se tem todas
     */
    canAll(userId, permissions, context = {}) {
        return permissions.every(perm => this.can(userId, perm, context));
    }

    /**
     * Verifica se usuário tem QUALQUER das permissões
     * @param {string} userId - ID do usuário
     * @param {string[]} permissions - Array de permissões
     * @param {object} context - Contexto adicional
     * @returns {boolean} - true se tem pelo menos uma
     */
    canAny(userId, permissions, context = {}) {
        return permissions.some(perm => this.can(userId, perm, context));
    }

    /**
     * Verifica negação explícita
     */
    hasExplicitDenial(user, permission) {
        // Verificar negação exata
        if (user.deniedPermissions.has(permission)) {
            return true;
        }

        // Verificar negação com wildcard
        for (const denied of user.deniedPermissions) {
            if (this.matchesPermission(permission, denied)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Verifica permissão customizada
     */
    hasCustomPermission(user, permission) {
        // Verificar permissão exata
        if (user.customPermissions.has(permission)) {
            return true;
        }

        // Verificar wildcard total
        if (user.customPermissions.has('*')) {
            return true;
        }

        // Verificar wildcard parcial (ex: 'forms:*' para 'forms:delete')
        for (const customPerm of user.customPermissions) {
            if (this.matchesPermission(permission, customPerm)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Verifica permissão de role
     */
    hasRolePermission(user, permission) {
        for (const roleName of user.roles) {
            const role = this.roles.get(roleName);
            if (!role) continue;

            // Wildcard total
            if (role.permissions.has('*')) {
                return true;
            }

            // Permissão exata
            if (role.permissions.has(permission)) {
                return true;
            }

            // Wildcard parcial
            for (const rolePerm of role.permissions) {
                if (this.matchesPermission(permission, rolePerm)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Verifica se permissão match com pattern (suporta wildcard)
     * @param {string} permission - Permissão a verificar (ex: 'forms:delete')
     * @param {string} pattern - Pattern com wildcard (ex: 'forms:*')
     * @returns {boolean} - true se match
     */
    matchesPermission(permission, pattern) {
        if (pattern === '*') return true;
        if (pattern === permission) return true;

        // Suportar wildcard (ex: 'forms:*' match 'forms:delete')
        if (pattern.endsWith(':*')) {
            const prefix = pattern.slice(0, -2);
            return permission.startsWith(prefix + ':');
        }

        // Suportar wildcard no início (ex: '*:delete')
        if (pattern.startsWith('*:')) {
            const suffix = pattern.slice(2);
            return permission.endsWith(':' + suffix);
        }

        return false;
    }

    /**
     * Registra checker customizado para validação condicional
     * @param {string} permission - Permissão
     * @param {Function} checker - Função que retorna boolean
     */
    registerChecker(permission, checker) {
        if (typeof checker !== 'function') {
            throw new TypeError('Checker must be a function');
        }
        this.customCheckers.set(permission, checker);
    }

    /**
     * Verifica se existe checker customizado
     */
    hasCustomChecker(permission) {
        return this.customCheckers.has(permission);
    }

    /**
     * Executa checker customizado
     */
    runCustomChecker(permission, userId, context) {
        const checker = this.customCheckers.get(permission);
        try {
            return checker(userId, context);
        } catch (error) {
            console.error(`❌ Erro ao executar checker para "${permission}":`, error);
            return false;
        }
    }

    /**
     * Retorna todas as permissões de um usuário
     * @param {string} userId - ID do usuário
     * @returns {Set} - Set de permissões
     */
    getUserPermissions(userId) {
        const user = this.userPermissions.get(userId);
        if (!user) return new Set();

        const permissions = new Set();

        // Adicionar permissões customizadas
        user.customPermissions.forEach(p => permissions.add(p));

        // Adicionar permissões das roles
        user.roles.forEach(roleName => {
            const role = this.roles.get(roleName);
            if (role) {
                role.permissions.forEach(p => permissions.add(p));
            }
        });

        // Remover permissões negadas
        user.deniedPermissions.forEach(p => permissions.delete(p));

        return permissions;
    }

    /**
     * Retorna roles de um usuário
     * @param {string} userId - ID do usuário
     * @returns {Set} - Set de roles
     */
    getUserRoles(userId) {
        const user = this.userPermissions.get(userId);
        return user ? user.roles : new Set();
    }

    /**
     * Verifica se usuário tem role
     * @param {string} userId - ID do usuário
     * @param {string} roleName - Nome da role
     * @returns {boolean} - true se tem a role
     */
    hasRole(userId, roleName) {
        const user = this.userPermissions.get(userId);
        return user ? user.roles.has(roleName) : false;
    }

    /**
     * Retorna role com maior hierarquia do usuário
     * @param {string} userId - ID do usuário
     * @returns {object|null} - Role com maior hierarquia
     */
    getHighestRole(userId) {
        const user = this.userPermissions.get(userId);
        if (!user || user.roles.size === 0) return null;

        let highestRole = null;
        let highestHierarchy = -1;

        user.roles.forEach(roleName => {
            const role = this.roles.get(roleName);
            if (role && role.metadata.hierarchy > highestHierarchy) {
                highestHierarchy = role.metadata.hierarchy;
                highestRole = { name: roleName, ...role };
            }
        });

        return highestRole;
    }

    /**
     * Cacheia resultado de verificação
     */
    cacheResult(key, result) {
        if (this.options.cacheEnabled) {
            this.cache.set(key, {
                result,
                timestamp: Date.now()
            });
        }
        return result;
    }

    /**
     * Limpa todo o cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Limpa cache de um usuário específico
     */
    clearCacheForUser(userId) {
        for (const key of this.cache.keys()) {
            if (key.startsWith(`${userId}:`)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Retorna estatísticas do sistema de permissões
     */
    getStats() {
        return {
            totalRoles: this.roles.size,
            totalUsers: this.userPermissions.size,
            cacheSize: this.cache.size,
            customCheckers: this.customCheckers.size,
            roles: Array.from(this.roles.entries()).map(([name, role]) => ({
                name,
                permissionCount: role.permissions.size,
                hierarchy: role.metadata.hierarchy
            }))
        };
    }

    /**
     * Exporta configuração completa
     */
    export() {
        return {
            roles: Array.from(this.roles.entries()).map(([name, role]) => ({
                name,
                permissions: Array.from(role.permissions),
                metadata: role.metadata
            })),
            users: Array.from(this.userPermissions.entries()).map(([userId, user]) => ({
                userId,
                roles: Array.from(user.roles),
                customPermissions: Array.from(user.customPermissions),
                deniedPermissions: Array.from(user.deniedPermissions)
            }))
        };
    }

    /**
     * Importa configuração
     */
    import(config) {
        // Importar roles
        if (config.roles) {
            config.roles.forEach(role => {
                this.addRole(role.name, role.permissions, role.metadata);
            });
        }

        // Importar usuários
        if (config.users) {
            config.users.forEach(user => {
                user.roles.forEach(role => this.assignRole(user.userId, role));
                user.customPermissions.forEach(perm => this.grantPermission(user.userId, perm));
                user.deniedPermissions.forEach(perm => this.denyPermission(user.userId, perm));
            });
        }

        eventBus.emit('permissionsImported', { config });
    }
}

export default PermissionManager;
