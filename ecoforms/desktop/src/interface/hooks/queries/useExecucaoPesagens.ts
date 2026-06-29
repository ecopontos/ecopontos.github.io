"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";
import type { ExecucaoPesagem } from "@/src/domain/logistics/LogisticsRepository";

export function usePesagensByExecucao(execucaoId: string | null) {
    const [data, setData] = useState<ExecucaoPesagem[]>([]);
    const [loading, setLoading] = useState(false);

    const fetch = useCallback(async () => {
        if (!execucaoId) { setData([]); return; }
        setLoading(true);
        try {
            const c = await getContainerAsync();
            const rows = await c.logisticsRepository.findPesagensByExecucao(execucaoId);
            setData(rows);
        } finally {
            setLoading(false);
        }
    }, [execucaoId]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
}
