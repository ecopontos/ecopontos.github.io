"use client";

import { useAuth } from "@/contexts/AuthContext";
import { getContainerAsync } from "@/src/infrastructure/container";
import type { WidgetConfig } from "@/src/application/widgets/WidgetRegistry";

export function useWidgetMutations(onSuccess?: () => void) {
    const { user } = useAuth();

    const add = async (widget: WidgetConfig) => {
        if (!user?.id) return;
        const c = await getContainerAsync();
        await c.widgets.add.execute({
            userId: user.id,
            dashboardId: "main",
            widgetType: widget.type,
            dataSource: { registryId: widget.id, ...widget.dataSource },
            displayConfig: widget.options ?? {},
        });
        onSuccess?.();
    };

    const remove = async (instanceId: string) => {
        if (!user?.id) return;
        const c = await getContainerAsync();
        await c.widgets.remove.execute(instanceId, user.id);
        onSuccess?.();
    };

    return { add, remove };
}
