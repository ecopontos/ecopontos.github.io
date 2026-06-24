"use client";

import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface ResiduoExterno {
    id_cad_residuo: number;
    descricao: string;
    sigla: string | null;
    ativo: boolean;
}

interface FetchResiduosResult {
    dados: ResiduoExterno[];
    total: number;
    conectado: boolean;
}

interface SyncResult {
    inseridos: number;
    atualizados: number;
    erros: number;
    total_externo: number;
    mensagem: string;
}

const PG_CONFIG = {
    pgHost: "172.16.76.202",
    pgPort: 5432,
    pgDb: "geo_fpolis",
    pgUser: "smma",
    pgPassword: "H6N3pNTVcr",
};

export function useExternalResiduos() {
    const [residuos, setResiduos] = useState<ResiduoExterno[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [syncResult, setSyncResult] = useState<string | null>(null);
    const [total, setTotal] = useState(0);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await invoke<FetchResiduosResult>("fetch_residuos_externos", PG_CONFIG);
            setResiduos(result.dados);
            setTotal(result.total);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
            setResiduos([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const sync = useCallback(async () => {
        setSyncing(true);
        setError(null);
        setSyncResult(null);
        try {
            const result = await invoke<SyncResult>("sync_residuos_externos", PG_CONFIG);
            setSyncResult(result.mensagem);
            await fetch();
            return result;
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
            return null;
        } finally {
            setSyncing(false);
        }
    }, [fetch]);

    useEffect(() => {
        fetch();
    }, [fetch]);

    return { residuos, total, loading, syncing, error, syncResult, refetch: fetch, sync };
}
