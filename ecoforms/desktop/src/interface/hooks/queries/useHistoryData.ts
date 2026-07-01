"use client";
import { useCallback, useMemo } from "react";
import type { TblSuiteRecord } from "@/types";
import { useTauriQuery } from "@/src/interface/hooks/catalog/tauri";
import { useSqlite } from "./useSqlite";
import { PACOTES_HISTORICO, PACOTE_RESTORE, PACOTE_CLOSE } from "@/src/infrastructure/persistence/sqlite/queries/pacotes";

const safeJsonParse = (val: string | null | undefined, fallback: unknown) => {
    if (!val) return fallback;
    try { return JSON.parse(val); } catch { return fallback; }
};

export function useHistoryData() {
    const sqlite = useSqlite();
    const { data: rows, isPending, refetch } = useTauriQuery<TblSuiteRecord>(PACOTES_HISTORICO.sql, []);

    const data = useMemo(() => (rows ?? []).map((row) => {
        const rec = { ...row } as TblSuiteRecord;
        if (typeof rec.dados === "string") {
            rec.dados = safeJsonParse(rec.dados, {}) as Record<string, unknown>;
        }
        return rec;
    }), [rows]);

    const restoreRecord = useCallback(async (id: string) => {
        await sqlite.execute(PACOTE_RESTORE.sql, [id]);
        await refetch();
    }, [sqlite, refetch]);

    const deleteRecord = useCallback(async (id: string) => {
        await sqlite.execute(PACOTE_CLOSE.sql, [id]);
        await refetch();
    }, [sqlite, refetch]);

    return {
        data,
        loading: isPending,
        restoreRecord,
        deleteRecord,
        refetch: () => refetch(),
    };
}
