import { useState, useEffect, useCallback, useRef } from 'react';
import { getContainerAsync } from '@/src/infrastructure/container';
import type { ManifestacaoSummary, ManifestacaoFilter, Cobranca } from '@/src/domain/ouvidoria/ManifestacaoRepository';

export function useManifestacoes(filter?: ManifestacaoFilter) {
    const [data, setData] = useState<ManifestacaoSummary[]>([]);
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
            const rows = await container.manifestacaoRepository.findAll(filterRef.current);
            setData(rows);
        } catch (e) {
            console.error('[useManifestacoes] fetch error:', e);
            setError(e instanceof Error ? e.message : 'Erro ao carregar manifestações');
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterKey]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, error, refetch: fetch };
}

export function useManifestacaoById(id: string | null) {
    const [manifestacao, setManifestacao] = useState<ManifestacaoSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!id) { if (!cancelled) { setManifestacao(null); setLoading(false); setError(null); } return; }
            if (!cancelled) { setLoading(true); setError(null); }
            try {
                const c = await getContainerAsync();
                const r = await c.manifestacaoRepository.findById(id);
                if (!cancelled) { setManifestacao(r); setLoading(false); }
            } catch (e) {
                console.error('[useManifestacaoById] fetch error:', e);
                if (!cancelled) { setError(e instanceof Error ? e.message : 'Erro ao carregar manifestação'); setLoading(false); }
            }
        };
        load();
        return () => { cancelled = true; };
    }, [id, tick]);

    const refetch = () => setTick(t => t + 1);

    return { manifestacao, loading, error, refetch };
}

export function useManifestacaoByProtocolo(protocolo: string | null) {
    const [manifestacao, setManifestacao] = useState<ManifestacaoSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!protocolo) {
                if (!cancelled) { setManifestacao(null); setLoading(false); setError(null); }
                return;
            }
            if (!cancelled) { setLoading(true); setError(null); }
            try {
                const c = await getContainerAsync();
                const r = await c.manifestacaoRepository.findByProtocolo(protocolo);
                if (!cancelled) { setManifestacao(r); setLoading(false); }
            } catch (e) {
                console.error('[useManifestacaoByProtocolo] fetch error:', e);
                if (!cancelled) { setError(e instanceof Error ? e.message : 'Erro ao buscar por protocolo'); setLoading(false); }
            }
        };
        load();
        return () => { cancelled = true; };
    }, [protocolo]);

    return { manifestacao, loading, error };
}

function useManifestacaoListQuery<T>(
    id: string | null,
    fetcher: (repo: import('@/src/domain/ouvidoria/ManifestacaoRepository').ManifestacaoRepository) => Promise<T[]>
) {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;

    const fetch = useCallback(async () => {
        if (!id) { setData([]); setLoading(false); setError(null); return; }
        setLoading(true);
        setError(null);
        try {
            const c = await getContainerAsync();
            const rows = await fetcherRef.current(c.manifestacaoRepository);
            setData(rows);
        } catch (e) {
            console.error('[useManifestacaoListQuery] fetch error:', e);
            setError(e instanceof Error ? e.message : 'Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, error, refetch: fetch };
}

export function useManifestacaoTramitacoes(id: string | null) {
    return useManifestacaoListQuery(id, repo => repo.listTramitacoes(id!));
}

export function useManifestacaoRespostas(id: string | null) {
    return useManifestacaoListQuery(id, repo => repo.listRespostas(id!));
}

export function useManifestacaoDespachos(id: string | null) {
    return useManifestacaoListQuery(id, repo => repo.listDespachos(id!));
}

export function useManifestacaoAnexos(id: string | null) {
    return useManifestacaoListQuery(id, repo => repo.listAnexos(id!));
}

export function useManifestacaoPrazos(id: string | null) {
    return useManifestacaoListQuery(id, repo => repo.listPrazos(id!));
}

export function useManifestacaoEnvios(id: string | null) {
    return useManifestacaoListQuery(id, repo => repo.listEnvios(id!));
}

export function useManifestacaoCobranças(manifestacaoId: string | null) {
    return useManifestacaoListQuery<Cobranca>(manifestacaoId, repo => repo.listCobranças(manifestacaoId!));
}
