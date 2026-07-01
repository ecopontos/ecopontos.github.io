"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import { getContainerAsync } from "../utils/useContainer";
import type { ExecucaoCliente } from "@/src/domain/execucao-cliente/ExecucaoCliente";

export function useExecucoesClientes(execucaoId?: string) {
    const [data, setData] = useState<ExecucaoCliente[]>([]);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const c = await getContainerAsync();
            const rows = execucaoId
                ? await c.execucaoClienteRepository.findByExecucao(execucaoId)
                : await c.execucaoClienteRepository.findAll();
            setData(rows);
        } finally {
            setLoading(false);
        }
    }, [execucaoId]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
}
