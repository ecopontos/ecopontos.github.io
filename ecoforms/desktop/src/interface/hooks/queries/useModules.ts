"use client";

import { useState, useEffect, useCallback } from 'react';
import { getContainerAsync } from '@/src/infrastructure/container';
import type { ModuleRegistry } from '@/src/domain/module/ModuleRegistry';
import type { CreateModuleInput } from '@/src/application/module/CreateModuleUseCase';

export function useModules(status?: 'draft' | 'published' | 'archived') {
    const [modules, setModules] = useState<ModuleRegistry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const container = await getContainerAsync();
            const items = await container.modules.list.execute(status);
            setModules(items);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setLoading(false);
        }
    }, [status]);

    useEffect(() => {
        load();
    }, [load]);

    const createModule = useCallback(async (input: CreateModuleInput) => {
        const container = await getContainerAsync();
        return container.modules.create.execute(input);
    }, []);

    const publishModule = useCallback(async (id: string) => {
        const container = await getContainerAsync();
        return container.modules.publish.execute(id);
    }, []);

    const archiveModule = useCallback(async (id: string) => {
        const container = await getContainerAsync();
        return container.modules.archive.execute(id);
    }, []);

    return { modules, loading, error, refetch: load, createModule, publishModule, archiveModule };
}
