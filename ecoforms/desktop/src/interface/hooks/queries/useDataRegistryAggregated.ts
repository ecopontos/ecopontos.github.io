"use client";

import { useState, useEffect, useCallback } from "react";
import { useDataRegistryUseCases } from "../domain/useDataRegistryUseCases";
import { loadCrmDataSource, getCrmDataSourceNames } from "@/src/interface/gateways/crm-datasources";
export { getCrmDataSourceNames };

export interface UseDataRegistryAggregatedResult {
    data: unknown[];
    loading: boolean;
    error: string | null;
    /** True quando o registry (tabela registro_dados) retornou 0 itens para o tipo.
     *  Util para distinguir "vazio real" do fallback CRM — ver bug K. */
    isEmptyFromRegistry: boolean;
    /** True quando os dados exibidos vieram do fallback CRM, nao do registry. */
    isCrmFallback: boolean;
    refetch: () => void;
}

/**
 * Hook que agrega os itens de um tipo do Data Registry (registro_dados) e,
 * quando o registry esta vazio, cai para o resolver CRM (setores_ativos, *_crm).
 *
 * Refetch: contador mutavel. Renderers podem chamar refetch() para revalidar
 * apos saber que o registry mudou (editor/import em outra tela). Antes era
 * one-shot e ficava stale ate remontar.
 */
export function useDataRegistryAggregated(tipo: string | undefined): UseDataRegistryAggregatedResult {
    const dr = useDataRegistryUseCases();
    const [data, setData] = useState<unknown[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEmptyFromRegistry, setIsEmptyFromRegistry] = useState(false);
    const [isCrmFallback, setIsCrmFallback] = useState(false);
    const [tick, setTick] = useState(0);

    const refetch = useCallback(() => setTick(t => t + 1), []);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!tipo) {
                if (!cancelled) { setData([]); setLoading(false); setError(null); setIsEmptyFromRegistry(false); setIsCrmFallback(false); }
                return;
            }
            if (!cancelled) { setLoading(true); setError(null); }
            try {
                // dr.aggregate e capturado aqui dentro; useDataRegistryUseCases ja
                // estabiliza via useMemo no useContainer, e o tick forc revalidacao.
                const result = await dr.aggregate.execute(tipo);
                if (cancelled) return;
                setIsEmptyFromRegistry(result.length === 0);
                if (result.length > 0) {
                    setData(result);
                    setIsCrmFallback(false);
                } else {
                    // Fallback: try CRM data source (ex: setores_ativos). So e aplicado
                    // para tipos que o CRM conhece; caso contrario devolve [] (vazio real).
                    const crmData = await loadCrmDataSource(tipo);
                    if (cancelled) return;
                    setData(crmData);
                    setIsCrmFallback(crmData.length > 0);
                }
            } catch (err) {
                if (cancelled) return;
                const msg = err instanceof Error ? err.message : 'Erro ao carregar dados do registry';
                console.error('[useDataRegistryAggregated]', tipo, msg);
                setError(msg);
                // On error, try CRM data source as fallback (best-effort), mas o erro
                // continua exposto via `error` para o renderer exibir, em vez de virar
                // silenciosamente [].
                try {
                    const crmData = await loadCrmDataSource(tipo);
                    if (cancelled) return;
                    setData(crmData);
                    setIsCrmFallback(crmData.length > 0);
                } catch {
                    if (!cancelled) { setData([]); setIsCrmFallback(false); }
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
        // dr.aggregate e estavel (useMemo no useContainer); tick forc revalidacao manual.
    }, [tipo, tick, dr]);

    return { data, loading, error, isEmptyFromRegistry, isCrmFallback, refetch };
}
