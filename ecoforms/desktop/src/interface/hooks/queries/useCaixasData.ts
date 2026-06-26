"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";

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
                `SELECT id_pacote AS id, criado_em, carga_json AS dados, id_proprietario AS user_id
                 FROM pacotes
                 WHERE tipo_modulo = 'ecopontoCaixasForm' AND atual = 1
                 ORDER BY criado_em DESC`
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
