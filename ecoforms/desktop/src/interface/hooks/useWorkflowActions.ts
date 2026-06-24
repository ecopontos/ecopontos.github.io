"use client";

import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAvailableActions, type ActionButtonConfig } from "@/src/application/actions/ActionRegistry";

export function useWorkflowActions(
  targetType: string,
  formData: Record<string, unknown>
): ActionButtonConfig[] {
  const { user, permissions } = useAuth();

  return useMemo(() => {
    if (!user || !permissions.userRole) return [];
    return getAvailableActions(targetType, formData, permissions.userRole);
  }, [targetType, formData, user, permissions.userRole]);
}
