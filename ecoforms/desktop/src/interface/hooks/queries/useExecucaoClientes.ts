"use client";

import { useState, useEffect, useCallback } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";
import type { ExecucaoCliente } from "@/src/domain/logistics/LogisticsRepository";

export function useExecucaoClientes(execucaoId: string | null) {
    const [data, setData] = useState<ExecucaoCliente[]>([]);
    const [loading, setLoading] = useState(false);

    const fetch = useCallback(async () => {
        if (!execucaoId) { setData([]); return; }
        setLoading(true);
        try {
            const c = await getContainerAsync();
            const rows = await c.logisticsRepository.findExecucaoClientes(execucaoId);
            setData(rows);
        } finally {
            setLoading(false);
        }
    }, [execucaoId]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
}
