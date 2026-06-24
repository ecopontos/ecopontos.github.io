"use client";

import { useState, useEffect } from 'react';
import { getContainerAsync } from '@/src/infrastructure/container';
import type { ModuleRuntimeDto } from '@/src/domain/module/ModuleRegistry';

export function useModuleRuntime(slug: string | null | undefined, perfil: string | null | undefined) {
    const [data, setData] = useState<ModuleRuntimeDto | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!slug || !perfil) { if (!cancelled) setLoading(false); return; }
            if (!cancelled) setLoading(true);
            try {
                const c = await getContainerAsync();
                const result = await c.modules.getRuntime.execute(slug, perfil);
                if (!cancelled) { setData(result); setError(null); }
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [slug, perfil]);

    return { data, loading, error };
}
