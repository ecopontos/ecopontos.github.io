"use client";

import { useEffect, useState } from "react";
import { useTaskUseCases } from "../domain/useTaskUseCases";

export function useAssignedActiveForms(userId: string | undefined): string[] | undefined {
    const taskUseCases = useTaskUseCases();
    const [forms, setForms] = useState<string[] | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!userId) { if (!cancelled) setForms(undefined); return; }
            try {
                const rows = await taskUseCases.findAssignedActiveForms.execute(userId);
                if (!cancelled) setForms(rows);
            } catch {
                if (!cancelled) setForms(undefined);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [taskUseCases, userId]);

    return forms;
}
