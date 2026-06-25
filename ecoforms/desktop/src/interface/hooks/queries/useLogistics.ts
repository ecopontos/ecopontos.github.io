import { useState, useEffect, useCallback, useRef } from 'react';
import { getContainerAsync } from '@/src/infrastructure/container';
import type { Roteiro, RoteiroFilter, ExecucaoFilter, ExecucaoColeta, RoteiroCliente } from '@/src/domain/logistics/LogisticsRepository';

export function useRoteiros(filter?: RoteiroFilter) {
    const [data, setData] = useState<Roteiro[]>([]);
    const [loading, setLoading] = useState(true);
    const filterRef = useRef(filter);
    filterRef.current = filter;
    const filterKey = JSON.stringify(filter);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const container = await getContainerAsync();
            const repo = container.logisticsRepository;
            const rows = await repo.findAllRoteiros(filterRef.current);
            setData(rows);
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterKey]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
}

export function useRoteiroById(id: string | null) {
    const [roteiro, setRoteiro] = useState<Roteiro | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!id) { if (!cancelled) { setRoteiro(null); setLoading(false); } return; }
            if (!cancelled) setLoading(true);
            try {
                const c = await getContainerAsync();
                const r = await c.logisticsRepository.findRoteiroById(id);
                if (!cancelled) { setRoteiro(r); setLoading(false); }
            } catch { if (!cancelled) setLoading(false); }
        };
        load();
        return () => { cancelled = true; };
    }, [id]);

    return { roteiro, loading };
}

export function useExecucoes(filter?: ExecucaoFilter) {
    const [data, setData] = useState<ExecucaoColeta[]>([]);
    const [loading, setLoading] = useState(true);
    const execFilterRef = useRef(filter);
    execFilterRef.current = filter;
    const execFilterKey = JSON.stringify(filter);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const container = await getContainerAsync();
            const repo = container.logisticsRepository;
            const rows = await repo.findAllExecucoes(execFilterRef.current);
            setData(rows);
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [execFilterKey]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
}

export function useClientesByRoteiro(roteiroId: string | null) {
    const [data, setData] = useState<RoteiroCliente[]>([]);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        if (!roteiroId) { setData([]); setLoading(false); return; }
        setLoading(true);
        try {
            const container = await getContainerAsync();
            const rows = await container.logisticsRepository.findClientesByRoteiro(roteiroId);
            setData(rows);
        } finally {
            setLoading(false);
        }
    }, [roteiroId]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
}
