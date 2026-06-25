"use client";

import { useState, useEffect, useMemo } from 'react';
import { useSqlite } from './useSqlite';

export function useSQLiteColumnExists(tableName: string, columnName: string) {
    const sqlite = useSqlite();
    const safeName = useMemo(() => tableName.replace(/'/g, "''"), [tableName]);
    const [hasColumn, setHasColumn] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!cancelled) setLoading(true);
            try {
                const rows = await sqlite.query<{ name: string }>(`SELECT * FROM pragma_table_info('${safeName}')`);
                if (!cancelled) setHasColumn(rows.some(r => r.name === columnName));
            } catch (e) {
                if (!cancelled) setError(String(e));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [sqlite, safeName, columnName]);

    return { hasColumn, loading, error };
}
