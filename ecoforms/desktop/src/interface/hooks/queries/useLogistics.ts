import { useState, useEffect, useCallback, useRef } from 'react';
import { getContainerAsync } from '@/src/infrastructure/container';
import type { Roteiro, RoteiroFilter, ExecucaoFilter, ExecucaoColeta, RoteiroCliente } from '@/src/domain/logistics/LogisticsRepository';

export function useRoteiros(filter?: RoteiroFilter) {
    const [data, setData] = useState<Roteiro[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const filterRef = useRef(filter);
    filterRef.current = filter;
    const filterKey = JSON.stringify(filter);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const container = await getContainerAsync();
            const repo = container.logisticsRepository;
            const rows = await repo.findAllRoteiros(filterRef.current);
            setData(rows);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Erro ao carregar roteiros';
            console.error('[useRoteiros]', msg);
            setError(msg);
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterKey]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, error, refetch: fetch };
}

export function useRoteiroById(id: string | null) {
    const [roteiro, setRoteiro] = useState<Roteiro | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!id) { if (!cancelled) { setRoteiro(null); setLoading(false); setError(null); } return; }
            if (!cancelled) { setLoading(true); setError(null); }
            try {
                const c = await getContainerAsync();
                const r = await c.logisticsRepository.findRoteiroById(id);
                if (!cancelled) { setRoteiro(r); setLoading(false); }
            } catch (e: unknown) {
                if (!cancelled) {
                    const msg = e instanceof Error ? e.message : 'Erro ao carregar roteiro';
                    console.error('[useRoteiroById]', msg);
                    setError(msg);
                    setLoading(false);
                }
            }
        };
        load();
        return () => { cancelled = true; };
    }, [id]);

    return { roteiro, loading, error };
}

export function useExecucoes(filter?: ExecucaoFilter) {
    const [data, setData] = useState<ExecucaoColeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const execFilterRef = useRef(filter);
    execFilterRef.current = filter;
    const execFilterKey = JSON.stringify(filter);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const container = await getContainerAsync();
            const repo = container.logisticsRepository;
            const rows = await repo.findAllExecucoes(execFilterRef.current);
            setData(rows);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Erro ao carregar execuções';
            console.error('[useExecucoes]', msg);
            setError(msg);
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [execFilterKey]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, error, refetch: fetch };
}

export function useClientesByRoteiro(roteiroId: string | null) {
    const [data, setData] = useState<RoteiroCliente[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        if (!roteiroId) { setData([]); setLoading(false); setError(null); return; }
        setLoading(true);
        setError(null);
        try {
            const container = await getContainerAsync();
            const rows = await container.logisticsRepository.findClientesByRoteiro(roteiroId);
            setData(rows);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Erro ao carregar clientes do roteiro';
            console.error('[useClientesByRoteiro]', msg);
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [roteiroId]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, error, refetch: fetch };
}
