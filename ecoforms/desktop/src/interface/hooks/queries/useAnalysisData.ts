"use client";

import { useState, useEffect } from "react";
import { PACOTES_ANALISE } from "@/src/infrastructure/persistence/sqlite/queries/analysis";
import { getContainerAsync } from "@/src/infrastructure/container";
import { fetchPacoteFormTypes } from "@/src/interface/hooks/queries/lookups";

export function usePacoteFormTypes() {
    const [formTypes, setFormTypes] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const tipos = await fetchPacoteFormTypes();
                if (!cancelled) setFormTypes(tipos);
            } catch {
                if (!cancelled) setFormTypes([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    return { formTypes, loading };
}

interface AnalysisRecord {
    id: string;
    dados: string;
    criado_em: string;
    usuario: string;
    status: string;
}

export function usePacotesAnalise(
    formType: string,
    searchText: string,
    status: string,
    limit: number,
    refetchTrigger: number,
) {
    const [records, setRecords] = useState<AnalysisRecord[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!formType) { if (!cancelled) setRecords([]); return; }
            const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 1000));
            const params: unknown[] = [
                formType,
                searchText || '',
                searchText ? `%${searchText}%` : '',
                searchText ? `%${searchText}%` : '',
                status || 'all',
                status || 'all',
                safeLimit,
            ];
            if (!cancelled) setLoading(true);
            try {
                const c = await getContainerAsync();
                const rows = await c.sqlite.query<AnalysisRecord>(PACOTES_ANALISE.sql, params);
                if (!cancelled) setRecords(rows);
            } catch {
                if (!cancelled) setRecords([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [formType, searchText, status, limit, refetchTrigger]);

    return { records, loading };
}
