"use client";

import { useState, useEffect, useCallback } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";
import type { TipoPrazo } from "@/src/domain/tipo-prazo/TipoPrazo";

export function useTiposPrazo(ativosApenas = false) {
    const [data, setData] = useState<TipoPrazo[]>([]);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const c = await getContainerAsync();
            const rows = ativosApenas
                ? await c.tipoPrazoRepository.findAtivos()
                : await c.tipoPrazoRepository.findAll();
            setData(rows);
        } finally {
            setLoading(false);
        }
    }, [ativosApenas]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
}
