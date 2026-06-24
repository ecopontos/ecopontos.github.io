"use client";

import { useState, useEffect, useCallback } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";
import type { NotificacaoSolicitante } from "@/src/domain/notificacao-solicitante/NotificacaoSolicitante";

export function useNotificacoesSolicitante(manifestacaoId?: string) {
    const [data, setData] = useState<NotificacaoSolicitante[]>([]);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const c = await getContainerAsync();
            const rows = manifestacaoId
                ? await c.notificacaoSolicitanteRepository.findByManifestacao(manifestacaoId)
                : await c.notificacaoSolicitanteRepository.findAll();
            setData(rows);
        } finally {
            setLoading(false);
        }
    }, [manifestacaoId]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
}
