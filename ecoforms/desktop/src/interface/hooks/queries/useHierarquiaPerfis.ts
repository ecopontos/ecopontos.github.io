"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";
import type { HierarquiaPerfil } from "@/src/domain/hierarquia-perfil/HierarquiaPerfil";

export function useHierarquiaPerfis() {
    const [data, setData] = useState<HierarquiaPerfil[]>([]);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const c = await getContainerAsync();
            const rows = await c.hierarquiaPerfilRepository.findAll();
            setData(rows);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
}
