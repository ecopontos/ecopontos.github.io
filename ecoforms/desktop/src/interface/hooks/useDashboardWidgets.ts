"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { useAuth } from "@/src/interface/hooks/catalog/auth";
import {
    getAvailableWidgets,
    getWidgetById,
    type WidgetConfig,
} from "@/src/application/widgets/WidgetRegistry";
import { registerBuiltinWidgets } from "@/src/application/widgets/builtin/initializeWidgets";
import { getContainerAsync } from "./utils/useContainer";
import type { UserRole } from "@/src/interface/hooks/utils/usePermissions";

export interface DashboardWidget extends WidgetConfig {
    instanceId?: string;
}

let builtinsRegistered = false;

export function useDashboardWidgets() {
    const { user } = useAuth();
    const userId = user?.id as string | undefined;
    const userRole = ((user?.perfil as string) || "operador") as UserRole;

    const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
    const [loading, setLoading] = useState(true);
    const [tick, setTick] = useState(0);

    const refetch = () => setTick((n) => n + 1);

    useEffect(() => {
        if (!builtinsRegistered) {
            registerBuiltinWidgets();
            builtinsRegistered = true;
        }

        if (!userId) {
            setWidgets(getAvailableWidgets(userRole).map((w) => ({ ...w })));
            setLoading(false);
            return;
        }

        setLoading(true);
        getContainerAsync()
            .then((c) => c.widgets.list.execute(userId))
            .then((instances) => {
                if (instances.length === 0) {
                    setWidgets(getAvailableWidgets(userRole).map((w) => ({ ...w })));
                    return;
                }
                const resolved: DashboardWidget[] = instances
                    .flatMap((inst) => {
                        let registryId: string | undefined;
                        try {
                            const ds = JSON.parse(inst.data_source) as Record<string, unknown>;
                            registryId = ds.registryId as string;
                        } catch { /* ignore */ }
                        const config = registryId ? getWidgetById(registryId) : undefined;
                        if (!config) return [];
                        return [{ ...config, instanceId: inst.id }];
                    });
                setWidgets(
                    resolved.length > 0
                        ? resolved
                        : getAvailableWidgets(userRole).map((w) => ({ ...w })),
                );
            })
            .catch(() => setWidgets(getAvailableWidgets(userRole).map((w) => ({ ...w }))))
            .finally(() => setLoading(false));
    }, [userId, userRole, tick]);

    return { widgets, loading, refetch };
}
