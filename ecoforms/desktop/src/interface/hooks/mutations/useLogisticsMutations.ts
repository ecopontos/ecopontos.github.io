import { useState, useCallback } from 'react';
import { getContainerAsync } from '@/src/infrastructure/container';
import type { Roteiro, RoteiroCliente, ExecucaoColeta, ChecklistExecucao, Intercorrencia } from '@/src/domain/logistics/LogisticsRepository';

export function useLogisticsMutations() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const withLoading = async <T,>(fn: () => Promise<T>): Promise<T> => {
        setLoading(true);
        setError(null);
        try {
            return await fn();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Erro desconhecido');
            throw e;
        } finally {
            setLoading(false);
        }
    };

    const saveRoteiro = useCallback(async (roteiro: Roteiro) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.logisticsRepository.saveRoteiro(roteiro);
        });
    }, []);

    const removeRoteiro = useCallback(async (id: string) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.logisticsRepository.deleteRoteiro(id);
        });
    }, []);

    const addClienteToRoteiro = useCallback(async (rc: RoteiroCliente) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.logisticsRepository.addClienteToRoteiro(rc);
        });
    }, []);

    const removeClienteFromRoteiro = useCallback(async (roteiroId: string, clienteId: string) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.logisticsRepository.removeClienteFromRoteiro(roteiroId, clienteId);
        });
    }, []);

    const updateClienteOrdem = useCallback(async (roteiroId: string, clienteId: string, ordem: number) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.logisticsRepository.updateClienteOrdem(roteiroId, clienteId, ordem);
        });
    }, []);

    const updateClienteOrdemBatch = useCallback(async (roteiroId: string, items: { clienteId: string; ordem: number }[]) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.logisticsRepository.updateClienteOrdemBatch(roteiroId, items);
        });
    }, []);

    const saveExecucao = useCallback(async (exec: ExecucaoColeta) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.logisticsRepository.saveExecucao(exec);
        });
    }, []);

    const updateExecucaoStatus = useCallback(async (id: string, status: string, fimEm?: string) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.logisticsRepository.updateExecucaoStatus(id, status, fimEm);
        });
    }, []);

    const transicaoExecucaoStatus = useCallback(async (execucaoId: string, novoStatus: string) => {
        const fimEm = (novoStatus === "concluida" || novoStatus === "cancelada") ? new Date().toISOString() : undefined;
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.logisticsRepository.updateExecucaoStatus(execucaoId, novoStatus, fimEm);
        });
    }, []);

    const removeExecucao = useCallback(async (id: string) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.logisticsRepository.deleteExecucao(id);
        });
    }, []);

    const saveChecklistItem = useCallback(async (item: ChecklistExecucao) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.logisticsRepository.saveChecklistItem(item);
        });
    }, []);

    const completeChecklistItem = useCallback(async (
        id: string, concluidoPor: string, observacao?: string, evidenciaUrl?: string, latitude?: number, longitude?: number
    ) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.logisticsRepository.completeChecklistItem(id, concluidoPor, observacao, evidenciaUrl, latitude, longitude);
        });
    }, []);

    const saveIntercorrencia = useCallback(async (item: Intercorrencia) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.logisticsRepository.saveIntercorrencia(item);
        });
    }, []);

    const resolverIntercorrencia = useCallback(async (id: string, resolvidoPor: string, resolvidoComo: string) => {
        return withLoading(async () => {
            const c = await getContainerAsync();
            await c.logisticsRepository.resolverIntercorrencia(id, resolvidoPor, resolvidoComo);
        });
    }, []);

    return {
        saveRoteiro, removeRoteiro,
        addClienteToRoteiro, removeClienteFromRoteiro, updateClienteOrdem, updateClienteOrdemBatch,
        saveExecucao, updateExecucaoStatus, transicaoExecucaoStatus, removeExecucao,
        saveChecklistItem, completeChecklistItem,
        saveIntercorrencia, resolverIntercorrencia,
        loading, error,
    };
}
