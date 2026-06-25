import { useState, useEffect, useCallback, useRef } from 'react';
import { getContainerAsync } from '@/src/infrastructure/container';
import type { ManifestacaoSummary, ManifestacaoFilter } from '@/src/domain/ouvidoria/ManifestacaoRepository';
import { MANIFESTACOES_COBRANCAS } from '@/src/infrastructure/persistence/sqlite/queries/manifestacoes';

export function useManifestacoes(filter?: ManifestacaoFilter) {
    const [data, setData] = useState<ManifestacaoSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const filterRef = useRef(filter);
    filterRef.current = filter;
    const filterKey = JSON.stringify(filter);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const container = await getContainerAsync();
            const rows = await container.manifestacaoRepository.findAll(filterRef.current);
            setData(rows);
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterKey]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
}

export function useManifestacaoById(id: string | null) {
    const [manifestacao, setManifestacao] = useState<ManifestacaoSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!id) { if (!cancelled) { setManifestacao(null); setLoading(false); } return; }
            if (!cancelled) setLoading(true);
            try {
                const c = await getContainerAsync();
                const r = await c.manifestacaoRepository.findById(id);
                if (!cancelled) { setManifestacao(r); setLoading(false); }
            } catch { if (!cancelled) setLoading(false); }
        };
        load();
        return () => { cancelled = true; };
    }, [id, tick]);

    const refetch = () => setTick(t => t + 1);

    return { manifestacao, loading, refetch };
}

export function useManifestacaoByProtocolo(protocolo: string | null) {
    const [manifestacao, setManifestacao] = useState<ManifestacaoSummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!protocolo) {
                if (!cancelled) { setManifestacao(null); setLoading(false); }
                return;
            }
            if (!cancelled) setLoading(true);
            try {
                const c = await getContainerAsync();
                const r = await c.manifestacaoRepository.findByProtocolo(protocolo);
                if (!cancelled) { setManifestacao(r); setLoading(false); }
            } catch {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [protocolo]);

    return { manifestacao, loading };
}

function useManifestacaoListQuery<T>(
    id: string | null,
    fetcher: (repo: import('@/src/domain/ouvidoria/ManifestacaoRepository').ManifestacaoRepository) => Promise<T[]>
) {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;

    const fetch = useCallback(async () => {
        if (!id) { setData([]); setLoading(false); return; }
        setLoading(true);
        try {
            const c = await getContainerAsync();
            const rows = await fetcherRef.current(c.manifestacaoRepository);
            setData(rows);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
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

interface Cobranca {
    id: string;
    mensagem: string;
    criado_em: string;
    usuario_nome: string;
}

export function useManifestacaoEnvios(id: string | null) {
    return useManifestacaoListQuery(id, repo => repo.listEnvios(id!));
}

export function useManifestacaoCobranças(manifestacaoId: string | null) {
    const [data, setData] = useState<Cobranca[]>([]);
    const [loading, setLoading] = useState(false);

    const fetch = useCallback(async () => {
        if (!manifestacaoId) { setData([]); return; }
        setLoading(true);
        try {
            const c = await getContainerAsync();
            const rows = await c.sqlite.query<Cobranca>(
                MANIFESTACOES_COBRANCAS.sql,
                [manifestacaoId],
            );
            setData(rows);
        } finally {
            setLoading(false);
        }
    }, [manifestacaoId]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
}
