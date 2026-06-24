"use client";

import { useState, useCallback } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";
import type { ExecucaoCliente } from "@/src/domain/logistics/LogisticsRepository";
import { uuidv7 } from "ecoforms-core";

export function useExecucaoClientesMutations() {
    const [loading, setLoading] = useState(false);

    const saveExecucaoCliente = useCallback(async (item: Omit<ExecucaoCliente, "id" | "registradoEm">) => {
        setLoading(true);
        try {
            const c = await getContainerAsync();
            const now = new Date().toISOString();
            await c.logisticsRepository.saveExecucaoCliente({
                ...item,
                id: uuidv7(),
                registradoEm: now,
            } as ExecucaoCliente);
        } finally {
            setLoading(false);
        }
    }, []);

    const batchSaveExecucaoClientes = useCallback(async (
        items: Array<{ clienteId: string; coletaRealizada: number; quantidade?: number | null; ocorrencia?: string; observacao?: string }>,
        execucaoId: string,
        registradoPor: string,
    ): Promise<{ saved: number; failed: string[] }> => {
        setLoading(true);
        const failed: string[] = [];
        try {
            const c = await getContainerAsync();
            const now = new Date().toISOString();
            for (const item of items) {
                try {
                    await c.logisticsRepository.saveExecucaoCliente({
                        id: uuidv7(),
                        execucaoId,
                        clienteId: item.clienteId,
                        coletaRealizada: item.coletaRealizada,
                        quantidade: item.quantidade ?? null,
                        ocorrencia: item.ocorrencia || null,
                        observacao: item.observacao || null,
                        registradoPor,
                        registradoEm: now,
                    } as ExecucaoCliente);
                } catch {
                    failed.push(item.clienteId);
                }
            }
        } finally {
            setLoading(false);
        }
        return { saved: items.length - failed.length, failed };
    }, []);

    return { saveExecucaoCliente, batchSaveExecucaoClientes, loading };
}
