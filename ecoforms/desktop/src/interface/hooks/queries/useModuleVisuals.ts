"use client";

import { useState, useEffect } from 'react';
import { getContainerAsync } from '@/src/infrastructure/container';
import type { VisualData } from '@/components/module-runtime/VisualRenderer';

export function useModuleVisuals(slug: string | null | undefined, userId: string | null | undefined, perfil: string | null | undefined) {
    const [visuals, setVisuals] = useState<VisualData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!slug || !userId || !perfil) { if (!cancelled) setLoading(false); return; }
            if (!cancelled) setLoading(true);
            try {
                const c = await getContainerAsync();
                const result = await c.visuals.getModuleVisuais.execute(slug, userId, perfil);
                if (!cancelled && result) {
                    const merged = result.visuais.map(v => ({
                        ...v,
                        config: typeof v.config === 'string' ? JSON.parse(v.config) : v.config,
                    }));
                    setVisuals(merged);
                }
            } catch (err) {
                console.error('[useModuleVisuals]', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [slug, userId, perfil]);

    return { visuals, loading };
}
