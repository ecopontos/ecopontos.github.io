"use client";

import { useState, useEffect } from 'react';
import { loadCrmDataSource } from '@/src/infrastructure/config/crm-datasources';

export function useCrmDataSource<T = unknown>(dataSourceName: string | null | undefined) {
    const [rows, setRows] = useState<T[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!dataSourceName) return;
            if (!cancelled) setLoading(true);
            try {
                const result = await loadCrmDataSource(dataSourceName);
                if (!cancelled) setRows(result as T[]);
            } catch {
                if (!cancelled) setRows([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [dataSourceName]);

    return { rows, loading };
}
