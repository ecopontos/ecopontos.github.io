/**
 * usePermissions Hook - Sistema de permissões RBAC para EcoForms Desktop
 * ADR-009: Adapter legado que delega ao PermissionActionRegistry
 *
 * Durante a migração, este arquivo mantém compatibilidade reversa
 * enquanto delega permissões simples para o registry unificado.
 */

import { User } from "@/types";
import { initializePermissionRegistry, globalPermissionRegistry, type UserRole } from "@/src/application/permissions/PermissionActionAdapter";

// Inicializar registry na primeira importação
initializePermissionRegistry();

export type { UserRole } from "@/src/application/permissions/PermissionActionAdapter";

export type Permission =
    | "users.create"
    | "users.edit"
    | "users.delete"
    | "users.view_all"
    | "users.change_password"
    | "forms.create"
    | "forms.edit"
    | "forms.delete"
    | "forms.assign"
    | "forms.fill"
    | "data.view_all"
    | "data.view_own"
    | "data.edit_all"
    | "data.edit_own"
    | "data.delete"
    | "data.export"
    | "data.archive"
    | "system.config"
    | "system.logs"
    | "system.sync"
    | "system.device_setup"
    | "reports.view"
    | "reports.export"
    | "activities.manage"
    | "clients.view"
    | "clients.create"
    | "clients.edit"
    | "clients.delete"
    | "clients.export"
    | "tasks.reassign";

export interface UsePermissionsReturn {
    hasPermission: (permission: Permission) => boolean;
    canEditUser: (targetUser: User) => boolean;
    canEditData: (dataRecord: { criado_em?: string; created_at?: string; user_id?: string }) => boolean;
    canCreateUserWithRole: (role: UserRole) => boolean;
    canAccessForm: (formId: string) => boolean;
    isAdmin: () => boolean;
    isManager: () => boolean;
    isOperator: () => boolean;
    userRole: UserRole | null;
}

/**
 * Hook para verificação de permissões baseado no usuário atual.
 * @param assignedActiveForms form_registry_id das tarefas ativas atribuídas ao usuário
 */
export function usePermissions(user: User | null, assignedActiveForms?: string[]): UsePermissionsReturn {
    const normalizeRole = (perfil: string): UserRole | null => {
        const roleMap: Record<string, UserRole> = {
            admin: "admin",
            gerente: "gerente",
            coordenador: "coordenador",
            campo: "campo",
            operador: "operador",
            encarregado: "encarregado",
        };
        return roleMap[perfil.toLowerCase()] || null;
    };

    const userRole = user ? normalizeRole(user.perfil) : null;

    const isAdmin = (): boolean => userRole === "admin";
    const isManager = (): boolean => userRole === "gerente";
    const isOperator = (): boolean => userRole === "campo" || userRole === "operador";

    // Mapeamento de permissões legadas para ações universais no registry
    const LEGACY_TO_REGISTRY: Record<string, { action: string; entity: string }> = {
        // Clientes
        "clients.view": { action: "VISUALIZAR", entity: "client" },
        "clients.create": { action: "CRIAR", entity: "client" },
        "clients.edit": { action: "EDITAR", entity: "client" },
        "clients.delete": { action: "EXCLUIR", entity: "client" },
        "clients.export": { action: "EXPORTAR", entity: "client" },
        // Formulários
        "forms.create": { action: "CRIAR", entity: "form" },
        "forms.edit": { action: "EDITAR", entity: "form" },
        "forms.delete": { action: "EXCLUIR", entity: "form" },
        "forms.fill": { action: "VISUALIZAR", entity: "form" },
        // Relatórios
        "reports.view": { action: "VISUALIZAR", entity: "report" },
        "reports.export": { action: "EXPORTAR", entity: "report" },
        // Atividades
        "activities.manage": { action: "GERENCIAR", entity: "activity" },
        // Tarefas
        "tasks.reassign": { action: "GERENCIAR", entity: "task" },
        // Usuários
        "users.create": { action: "CRIAR", entity: "user" },
        "users.edit": { action: "EDITAR", entity: "user" },
        "users.delete": { action: "EXCLUIR", entity: "user" },
        "users.view_all": { action: "VISUALIZAR", entity: "user" },
        "users.change_password": { action: "EDITAR", entity: "user" },
        // Dados
        "data.view_all": { action: "VISUALIZAR", entity: "data" },
        "data.view_own": { action: "VISUALIZAR", entity: "data" },
        "data.edit_all": { action: "EDITAR", entity: "data" },
        "data.edit_own": { action: "EDITAR", entity: "data" },
        "data.delete": { action: "EXCLUIR", entity: "data" },
        "data.export": { action: "EXPORTAR", entity: "data" },
        "data.archive": { action: "ARQUIVAR", entity: "data" },
        // Sistema
        "system.config": { action: "GERENCIAR", entity: "system" },
        "system.logs": { action: "VISUALIZAR", entity: "system" },
        "system.sync": { action: "VISUALIZAR", entity: "system" },
        "system.device_setup": { action: "GERENCIAR", entity: "system" },
    };

    const hasPermission = (permission: Permission): boolean => {
        if (!user || !userRole) return false;

        // Delegar para PermissionActionRegistry se mapeada
        const mapped = LEGACY_TO_REGISTRY[permission];
        if (mapped) {
            return globalPermissionRegistry.canExecute(
                mapped.action as import('ecoforms-core/permissions').UniversalAction,
                mapped.entity,
                { userId: user.id, userRole, entity: mapped.entity }
            );
        }

        // Fallback legado: apenas forms.assign (operação específica não mapeada no registry)
        if (permission === 'forms.assign') {
            return ['admin', 'gerente'].includes(userRole);
        }
        return false;
    };

    const canEditUser = (targetUser: User): boolean => {
        if (!user || !userRole) return false;
        if (isAdmin()) return true;
        if (isManager()) {
            const targetRole = normalizeRole(targetUser.perfil);
            return targetRole === "coordenador" || targetRole === "campo" || targetRole === "operador" || targetRole === "encarregado";
        }
        return targetUser.id === user.id;
    };

    const canEditData = (dataRecord: { criado_em?: string; created_at?: string; user_id?: string }): boolean => {
        if (!user || !userRole) return false;
        if (isAdmin() || isManager()) return true;
        const timestamp = dataRecord.criado_em || dataRecord.created_at;
        if (!timestamp) return false;
        const createdAt = new Date(timestamp);
        const hoursAgo = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        if (userRole === "coordenador") {
            return hoursAgo <= 48 && dataRecord.user_id === user.id;
        }
        if (isOperator() && dataRecord.user_id === user.id) {
            return hoursAgo <= 24;
        }
        return false;
    };

    const canCreateUserWithRole = (role: UserRole): boolean => {
        if (!user || !userRole) return false;
        if (isAdmin()) return true;
        if (isManager()) {
            return role !== "admin" && role !== "gerente";
        }
        return false;
    };

    const canAccessForm = (formId: string): boolean => {
        if (!user) return false;
        if (isAdmin() || isManager()) return true;
        if (!assignedActiveForms) return false;
        return assignedActiveForms.includes(formId);
    };

    return {
        hasPermission,
        canEditUser,
        canEditData,
        canCreateUserWithRole,
        canAccessForm,
        isAdmin,
        isManager,
        isOperator,
        userRole,
    };
}
