"use client";

import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePgLegacyConfig } from "./useLegacySyncData";

interface SyncPesagensResult {
    inseridos: number;
    atualizados: number;
    execucoes_criadas: number;
    erros: number;
    total_externo: number;
    mensagem: string;
    detalhes_erros: string[];
}

export function useExternalPesagensSync() {
    const { config } = usePgLegacyConfig();
    const [syncing, setSyncing] = useState(false);
    const [lastResult, setLastResult] = useState<SyncPesagensResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const sync = useCallback(async (dataInicio: string, dataFim: string) => {
        setSyncing(true);
        setError(null);
        try {
            const result = await invoke<SyncPesagensResult>("sync_pesagens_externas", {
                ...config,
                dataInicio,
                dataFim,
            });
            setLastResult(result);
            return result;
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
            return null;
        } finally {
            setSyncing(false);
        }
    }, [config]);

    return { syncing, lastResult, error, sync };
}
