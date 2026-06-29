"use client";

import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface SyncPesagensResult {
    inseridos: number;
    atualizados: number;
    execucoes_criadas: number;
    erros: number;
    total_externo: number;
    mensagem: string;
    detalhes_erros: string[];
}

function isTauri() {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function useExternalPesagensSync() {
    const [syncing, setSyncing] = useState(false);
    const [lastResult, setLastResult] = useState<SyncPesagensResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const sync = useCallback(async (dataInicio: string, dataFim: string) => {
        if (!isTauri()) return null;
        setSyncing(true);
        setError(null);
        try {
            const result = await invoke<SyncPesagensResult>("sync_pesagens_externas", { dataInicio, dataFim });
            setLastResult(result);
            return result;
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
            return null;
        } finally {
            setSyncing(false);
        }
    }, []);

    return { syncing, lastResult, error, sync };
}
