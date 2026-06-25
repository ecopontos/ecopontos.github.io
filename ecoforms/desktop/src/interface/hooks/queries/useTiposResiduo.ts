"use client";

import { useState, useEffect, useCallback } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";
import type { TipoResiduo } from "@/src/domain/tipo-residuo/TipoResiduo";

export function useTiposResiduo(ativosApenas = false) {
    const [data, setData] = useState<TipoResiduo[]>([]);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const c = await getContainerAsync();
            const rows = ativosApenas
                ? await c.tipoResiduoRepository.findAtivos()
                : await c.tipoResiduoRepository.findAll();
            setData(rows);
        } finally {
            setLoading(false);
        }
    }, [ativosApenas]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
}
