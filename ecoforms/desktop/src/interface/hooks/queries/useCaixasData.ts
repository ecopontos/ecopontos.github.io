"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";
import { PACOTES_ECOPONTO_CAIXAS_ATUAIS } from "@/src/infrastructure/persistence/sqlite/queries/pacotes";

interface CaixasRow {
    id: string;
    criado_em: string;
    dados: string;
    user_id: string;
}

export function useCaixasData() {
    const [rawData, setRawData] = useState<CaixasRow[]>([]);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const c = await getContainerAsync();
            const rows = await c.sqlite.query<CaixasRow>(
                PACOTES_ECOPONTO_CAIXAS_ATUAIS.sql
            );
            setRawData(rows);
        } catch {
            setRawData([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    return { rawData, loading, refetch: fetch };
}
