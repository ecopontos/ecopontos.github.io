"use client";

import { useState, useEffect } from "react";
import { useDataRegistryUseCases } from "../domain/useDataRegistryUseCases";
import { loadCrmDataSource, getCrmDataSourceNames } from "@/src/infrastructure/config/crm-datasources";
export { getCrmDataSourceNames };

export function useDataRegistryAggregated(tipo: string | undefined): {
    data: unknown[];
    loading: boolean;
} {
    const dr = useDataRegistryUseCases();
    const [data, setData] = useState<unknown[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!tipo) { if (!cancelled) setData([]); return; }
            if (!cancelled) setLoading(true);
            try {
                const result = await dr.aggregate.execute(tipo);
                if (!cancelled) {
                    if (result.length > 0) {
                        setData(result);
                    } else {
                        // Fallback: try CRM data source (ex: setores_ativos)
                        const crmData = await loadCrmDataSource(tipo);
                        if (!cancelled) setData(crmData);
                    }
                    setLoading(false);
                }
            } catch {
                if (!cancelled) {
                    // On error, try CRM data source as fallback
                    try {
                        const crmData = await loadCrmDataSource(tipo);
                        if (!cancelled) setData(crmData);
                    } catch {
                        if (!cancelled) setData([]);
                    }
                    setLoading(false);
                }
            }
        };
        load();
        return () => { cancelled = true; };
    }, [tipo, dr.aggregate]);

    return { data, loading };
}
