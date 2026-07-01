/**
 * Componentes de Proteção e Controle de Acesso
 * Sistema RBAC para EcoForms Desktop
 */

"use client";

import { ReactNode } from "react";
import { useAuth } from "@/src/interface/hooks/catalog/auth";
import { Permission } from "@/src/interface/hooks/catalog/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * RequirePermission - Renderiza children apenas se usuário tiver permissão
 */
interface RequirePermissionProps {
    permission: Permission;
    children: ReactNode;
    fallback?: ReactNode;
}

export function RequirePermission({
    permission,
    children,
    fallback = null,
}: RequirePermissionProps) {
    const { permissions } = useAuth();

    if (!permissions.hasPermission(permission)) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

/**
 * ProtectedPage - HOC para proteger páginas inteiras
 */
interface ProtectedPageProps {
    permission: Permission;
    children: ReactNode;
    redirectTo?: string;
}

export function ProtectedPage({
    permission,
    children,
    redirectTo = "/",
}: ProtectedPageProps) {
    const { permissions, user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user) {
            if (!permissions.hasPermission(permission)) {
                console.warn(`🚫 Acesso negado: usuário não tem permissão '${permission}'`);
                router.push(redirectTo);
            }
        }
    }, [permission, permissions, user, loading, router, redirectTo]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    if (!permissions.hasPermission(permission)) {
        return null;
    }

    return <>{children}</>;
}

/**
 * ShowForRole - Mostra conteúdo apenas para perfis específicos
 */
interface ShowForRoleProps {
    roles: Array<"admin" | "gerente" | "coordenador" | "campo" | "operador" | "encarregado">;
    children: ReactNode;
    fallback?: ReactNode;
}

export function ShowForRole({ roles, children, fallback = null }: ShowForRoleProps) {
    const { permissions } = useAuth();

    if (!permissions.userRole || !roles.includes(permissions.userRole)) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

/**
 * ShowForAdmin - Atalho para mostrar apenas para admin
 */
export function ShowForAdmin({ children }: { children: ReactNode }) {
    return <ShowForRole roles={["admin"]}>{children}</ShowForRole>;
}

/**
 * ShowForManager - Atalho para mostrar apenas para admin e gerente
 */
export function ShowForManager({ children }: { children: ReactNode }) {
    return <ShowForRole roles={["admin", "gerente"]}>{children}</ShowForRole>;
}

/**
 * ShowForAdminOrManager - Atalho para mostrar apenas para admin e gerente (alias)
 */
export function ShowForAdminOrManager({ children }: { children: ReactNode }) {
    return <ShowForRole roles={["admin", "gerente"]}>{children}</ShowForRole>;
}

/**
 * HideForRole - Esconde conteúdo para perfis específicos
 */
interface HideForRoleProps {
    roles: Array<"admin" | "gerente" | "coordenador" | "campo" | "operador" | "encarregado">;
    children: ReactNode;
}

export function HideForRole({ roles, children }: HideForRoleProps) {
    const { permissions } = useAuth();

    if (permissions.userRole && roles.includes(permissions.userRole)) {
        return null;
    }

    return <>{children}</>;
}

/**
 * ShowForPermission - Mostra conteúdo apenas se usuário tiver permissão
 */
interface ShowForPermissionProps {
    permission: Permission;
    children: ReactNode;
    fallback?: ReactNode;
}

export function ShowForPermission({ permission, children, fallback = null }: ShowForPermissionProps) {
    const { permissions } = useAuth();

    if (!permissions.hasPermission(permission)) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

/**
 * HideForPermission - Esconde conteúdo se usuário tiver permissão
 */
interface HideForPermissionProps {
    permission: Permission;
    children: ReactNode;
}

export function HideForPermission({ permission, children }: HideForPermissionProps) {
    const { permissions } = useAuth();

    if (permissions.hasPermission(permission)) {
        return null;
    }

    return <>{children}</>;
}

/**
 * RequireAnyPermission - Renderiza children se usuário tiver PELO MENOS UMA das permissões
 */
interface RequireAnyPermissionProps {
    permissions: Permission[];
    children: ReactNode;
    fallback?: ReactNode;
}

export function RequireAnyPermission({ permissions: perms, children, fallback = null }: RequireAnyPermissionProps) {
    const { permissions } = useAuth();

    const hasAny = perms.some((p) => permissions.hasPermission(p));
    if (!hasAny) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

/**
 * RequireAllPermissions - Renderiza children apenas se usuário tiver TODAS as permissões
 */
interface RequireAllPermissionsProps {
    permissions: Permission[];
    children: ReactNode;
    fallback?: ReactNode;
}

export function RequireAllPermissions({ permissions: perms, children, fallback = null }: RequireAllPermissionsProps) {
    const { permissions } = useAuth();

    const hasAll = perms.every((p) => permissions.hasPermission(p));
    if (!hasAll) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}
