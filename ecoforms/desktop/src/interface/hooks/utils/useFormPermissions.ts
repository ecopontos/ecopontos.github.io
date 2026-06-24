"use client";

import { useAuth } from "@/contexts/AuthContext";
import { usePermissions, UsePermissionsReturn } from "./usePermissions";
import { useAssignedActiveForms } from "@/src/interface/hooks/queries/useAssignedActiveForms";

/**
 * Versão de usePermissions com canAccessForm() baseado em tarefas ativas.
 * Use este hook em páginas que precisam verificar acesso a formulários.
 */
export function useFormPermissions(): UsePermissionsReturn {
    const { user } = useAuth();
    const assignedForms = useAssignedActiveForms(user?.id);
    return usePermissions(user, assignedForms);
}
