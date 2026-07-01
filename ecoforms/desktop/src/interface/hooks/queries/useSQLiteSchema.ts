"use client";

import { useState, useEffect } from 'react';
import { useSqlite } from './useSqlite';
import { SQLITE_TABLE_INFO } from '@/src/infrastructure/persistence/sqlite/queries/system';

export function useSQLiteColumnExists(tableName: string, columnName: string) {
    const sqlite = useSqlite();
    const [hasColumn, setHasColumn] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!cancelled) setLoading(true);
            try {
                const rows = await sqlite.query<{ name: string }>(SQLITE_TABLE_INFO.sql, [tableName]);
                if (!cancelled) setHasColumn(rows.some(r => r.name === columnName));
            } catch (e) {
                if (!cancelled) setError(String(e));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [sqlite, tableName, columnName]);

    return { hasColumn, loading, error };
}
