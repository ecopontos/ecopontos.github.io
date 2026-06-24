/**
 * @deprecated Uso restrito a admin/inspector (debug). Não usar em hooks de negócio.
 * Substituído por repositórios + use cases + hooks de catálogo.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useSqlite } from "@/src/interface/hooks/queries/useSqlite";

export type SQLiteParam = string | number | boolean | null;

export interface SQLiteQueryResult<T> {
    data: T[];
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

export function useSQLiteQuery<T>(
    sql: string,
    params: SQLiteParam[] = [],
    options: {
        enabled?: boolean;
        dependencies?: unknown[];
    } = {}
): SQLiteQueryResult<T> {
    const sqlite = useSqlite();
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refetchTrigger, setRefetchTrigger] = useState(0);

    const paramsKey = JSON.stringify(params);
    const dependenciesKey = JSON.stringify(options.dependencies ?? []);

    const paramsRef = useRef(params);
    paramsRef.current = params;

    const enabled = options.enabled !== false;

    useEffect(() => {
        if (!enabled) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        async function executeQuery() {
            try {
                setLoading(true);
                setError(null);

                const results = await sqlite.query<T>(sql, paramsRef.current);

                if (!cancelled) {
                    setData(results);
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    const message = err instanceof Error ? err.message : 'Erro ao executar query';
                    console.error('❌ Erro ao executar query SQLite:', err);
                    console.error('   SQL:', sql);
                    setError(message);
                    setData([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        executeQuery();

        return () => {
            cancelled = true;
        };
    }, [enabled, sql, paramsKey, dependenciesKey, refetchTrigger, sqlite]);

    const refetch = () => {
        setRefetchTrigger(prev => prev + 1);
    };

    return { data, loading, error, refetch };
}
