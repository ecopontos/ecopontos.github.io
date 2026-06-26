"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";
import type { TblSuiteRecord } from "@/types";
import { PACOTES_HISTORICO, PACOTE_RESTORE, PACOTE_CLOSE } from "@/src/infrastructure/persistence/sqlite/queries/pacotes";

const safeJsonParse = (val: string | null | undefined, fallback: unknown) => {
    if (!val) return fallback;
    try { return JSON.parse(val); } catch { return fallback; }
};

export function useHistoryData() {
    const [data, setData] = useState<TblSuiteRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        try {
            const c = await getContainerAsync();
            const rows = await c.sqlite.query<TblSuiteRecord>(
                PACOTES_HISTORICO.sql
            );
            setData(rows.map(r => {
                const rec = { ...r } as TblSuiteRecord;
                if (typeof rec.dados === 'string') {
                    rec.dados = safeJsonParse(rec.dados, {}) as Record<string, unknown>;
                }
                return rec;
            }));
        } catch (e) {
            console.error('[useHistoryData]', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    const restoreRecord = useCallback(async (id: string) => {
        const c = await getContainerAsync();
        await c.sqlite.execute(
            PACOTE_RESTORE.sql,
            [id]
        );
        await fetchHistory();
    }, [fetchHistory]);

    const deleteRecord = useCallback(async (id: string) => {
        const c = await getContainerAsync();
        await c.sqlite.execute(
            PACOTE_CLOSE.sql,
            [id]
        );
        await fetchHistory();
    }, [fetchHistory]);

    return { data, loading, restoreRecord, deleteRecord, refetch: fetchHistory };
}
