"use client";

import { useState, useEffect } from 'react';
import { getContainerAsync } from '@/src/infrastructure/container';

export interface ViewSummary {
    id: string;
    titulo: string;
    layout: string;
    userId?: string | null;
    moduleType?: string | null;
    isTemplate: boolean;
    widgets: unknown;
}

export function useViewById(viewId: string | null | undefined) {
    const [data, setData] = useState<ViewSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!viewId) { if (!cancelled) setData(null); return; }
            if (!cancelled) { setLoading(true); setError(null); }
            try {
                const c = await getContainerAsync();
                const v = await c.views.get.execute(viewId);
                if (!cancelled) setData(v ?? null);
            } catch (e) {
                if (!cancelled) setError(String(e));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [viewId]);

    return { data, loading, error };
}

export function useActiveViews(moduleType?: string | null) {
    const [data, setData] = useState<ViewSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!cancelled) { setLoading(true); setError(null); }
            try {
                const c = await getContainerAsync();
                const all = await c.views.getActive.execute();
                if (!cancelled) {
                    const filtered = moduleType ? all.filter(v => v.moduleType === moduleType) : all;
                    setData(filtered);
                }
            } catch (e) {
                if (!cancelled) setError(String(e));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [moduleType]);

    return { data, loading, error };
}
