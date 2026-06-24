"use client";

import { useEffect, useState } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";

export function useAssignedActiveForms(userId: string | undefined): string[] | undefined {
    const [forms, setForms] = useState<string[] | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!userId) { if (!cancelled) setForms(undefined); return; }
            try {
                const c = await getContainerAsync();
                const rows = await c.tasks.findAssignedActiveForms.execute(userId);
                if (!cancelled) setForms(rows);
            } catch {
                if (!cancelled) setForms(undefined);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [userId]);

    return forms;
}
