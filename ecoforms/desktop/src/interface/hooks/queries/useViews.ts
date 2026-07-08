"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/src/interface/hooks/catalog/auth';
import { getContainerAsync } from '../utils/useContainer';
import type { ModuleDashboardVisualDto, ModuleDashboardWidget } from '@/src/application/views/ViewUseCases';

export interface ViewSummary {
    id: string;
    titulo: string;
    layout: string;
    userId?: string | null;
    moduleType?: string | null;
    isTemplate: boolean;
    widgets: unknown;
}

export interface ModuleDashboardMutationInput {
    moduleType: string;
    title: string;
    widgets?: Partial<ModuleDashboardWidget>[];
}

export interface UpdateModuleDashboardInput {
    id: string;
    title?: string;
    widgets?: Partial<ModuleDashboardWidget>[];
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

export function useModuleDashboardMutations(onSuccess?: () => void) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const perfil = String(user?.perfil ?? '');

    const run = useCallback(async <T>(operation: () => Promise<T>): Promise<T> => {
        setLoading(true);
        setError(null);
        try {
            const result = await operation();
            onSuccess?.();
            return result;
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            setError(message);
            throw e;
        } finally {
            setLoading(false);
        }
    }, [onSuccess]);

    const create = useCallback((input: ModuleDashboardMutationInput) => run(async () => {
        const c = await getContainerAsync();
        return c.views.createModuleDashboard.execute({
            moduleType: input.moduleType,
            title: input.title,
            perfil,
            widgets: input.widgets,
        });
    }), [perfil, run]);

    const update = useCallback((input: UpdateModuleDashboardInput) => run(async () => {
        const c = await getContainerAsync();
        return c.views.updateModuleDashboard.execute({
            id: input.id,
            perfil,
            title: input.title,
            widgets: input.widgets,
        });
    }), [perfil, run]);

    const updateWidgets = useCallback((id: string, widgets: Partial<ModuleDashboardWidget>[]) => run(async () => {
        const c = await getContainerAsync();
        return c.views.updateModuleDashboardWidgets.execute({ id, perfil, widgets });
    }), [perfil, run]);

    const remove = useCallback((id: string) => run(async () => {
        const c = await getContainerAsync();
        await c.views.deleteModuleDashboard.execute(id, perfil);
    }), [perfil, run]);

    return { create, update, updateWidgets, remove, loading, error };
}

export function useModuleDashboardData(
    slug: string | null | undefined,
    dashboardId: string | null | undefined,
    userId: string | null | undefined,
    userProfile: string | null | undefined,
) {
    const [data, setData] = useState<ModuleDashboardVisualDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!slug || !dashboardId || !userId || !userProfile) {
                if (!cancelled) setData([]);
                return;
            }
            if (!cancelled) { setLoading(true); setError(null); }
            try {
                const c = await getContainerAsync();
                const result = await c.views.getModuleDashboardData.execute({ slug, dashboardId, userId, userProfile });
                if (!cancelled) setData(result);
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : String(e));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [slug, dashboardId, userId, userProfile]);

    return { data, loading, error };
}
