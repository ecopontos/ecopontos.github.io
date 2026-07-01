"use client";

import { useState, useEffect } from "react";
import { FormContent } from "@/types";
import { getContainerAsync } from "../utils/useContainer";

export function useFormTemplate(slug: string | undefined) {
    const [template, setTemplate] = useState<FormContent | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!slug) { if (!cancelled) setTemplate(null); return; }
            if (!cancelled) setLoading(true);
            try {
                const c = await getContainerAsync();
                const data = await c.suiteRepository.getFormTemplate(slug);
                if (!cancelled) setTemplate(data as FormContent | null);
            } catch (err) {
                console.error("Error loading form template:", err);
                if (!cancelled) setTemplate(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [slug]);

    return { template, loading };
}
