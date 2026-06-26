"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import { getContainerAsync } from "@/src/infrastructure/container";
import { getInboxAccessFilter } from "@/src/interface/hooks/utils/useAccessFilters";
import { buildInboxAccessFilter, type SqlFilter } from "@/src/infrastructure/persistence/AccessFilterBuilder";
import { fetchInboxNormalizada } from "@/src/interface/hooks/queries/lookups";

export interface InboxViewRow {
    id: string;
    user_id: string | null;
    criado_em: string;
    tipo_form: string;
    titulo: string | null;
    usuario_nome_completo: string | null;
    localizacao: string | null;
    sync_status: string | null;
    lifecycle_status: string | null;
    dados_json: string | null;
    usuario_perfil: string | null;
}

export function useInboxData(userId: string | undefined, userPerfil: string | undefined, searchTerm: string) {
    const [data, setData] = useState<InboxViewRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [accessFilter, setAccessFilter] = useState<SqlFilter>({ clause: '1=0', params: [] });

    useEffect(() => {
        if (!userId || !userPerfil) return;
        getContainerAsync()
            .then(c => getInboxAccessFilter(userId, userPerfil, c.sqlite))
            .then(setAccessFilter)
            .catch(() => setAccessFilter(buildInboxAccessFilter(userId, userPerfil)));
    }, [userId, userPerfil]);

    const fetchData = useCallback(async () => {
        if (!userId) { setLoading(false); return; }
        setLoading(true);
        try {
            const result = await fetchInboxNormalizada({
                accessClause: accessFilter.clause,
                accessParams: accessFilter.params,
                searchTerm,
            });
            setData(result as unknown as InboxViewRow[]);
        } catch (e) {
            console.error('[useInboxData]', e);
        } finally {
            setLoading(false);
        }
    }, [userId, accessFilter.clause, accessFilter.params, searchTerm]);

    useEffect(() => { fetchData(); }, [fetchData]);

    return { data, loading, refetch: fetchData };
}
