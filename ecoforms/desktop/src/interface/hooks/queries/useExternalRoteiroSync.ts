"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface SyncStatus {
    total_externo: number;
    total_local: number;
    conectado: boolean;
}

interface SyncResult {
    inseridos: number;
    atualizados: number;
    erros: number;
    total_externo: number;
    mensagem: string;
    detalhes_erros: string[];
}

function isTauri() {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const LAST_SYNC_KEY = "ecoforms.sync.roteiros.lastSyncAt";

export function useExternalRoteiroSync() {
    const [status, setStatus] = useState<SyncStatus | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [lastResult, setLastResult] = useState<SyncResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lastSyncAt, setLastSyncAt] = useState<Date | null>(() => {
        if (typeof window === "undefined") return null;
        const stored = window.localStorage.getItem(LAST_SYNC_KEY);
        return stored ? new Date(stored) : null;
    });

    const checkStatus = useCallback(async () => {
        if (!isTauri()) return null;
        try {
            setError(null);
            const s = await invoke<SyncStatus>("sync_roteiros_status");
            setStatus(s);
            return s;
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
            setStatus(null);
            return null;
        }
    }, []);

    const sync = useCallback(async () => {
        if (!isTauri()) return null;
        setSyncing(true);
        setError(null);
        try {
            const result = await invoke<SyncResult>("sync_roteiros_externos");
            setLastResult(result);
            const now = new Date();
            if (typeof window !== "undefined") {
                window.localStorage.setItem(LAST_SYNC_KEY, now.toISOString());
            }
            setLastSyncAt(now);
            await checkStatus();
            return result;
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
            return null;
        } finally {
            setSyncing(false);
        }
    }, [checkStatus]);

    useEffect(() => {
        checkStatus();
    }, [checkStatus]);

    return { status, syncing, lastResult, error, sync, checkStatus, lastSyncAt };
}
