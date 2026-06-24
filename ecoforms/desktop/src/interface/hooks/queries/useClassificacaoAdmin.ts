import { useState, useEffect } from 'react';
import { getContainerAsync } from '@/src/infrastructure/container';
import type { ModeloResposta } from '@/src/domain/ouvidoria/ManifestacaoRepository';
import {
  CLASSIFICACAO_SUBASSUNTOS,
  CLASSIFICACAO_SUBUNIDADES,
  CLASSIFICACAO_PROGRAMAS_ORCAMENTARIOS,
} from '@/src/infrastructure/persistence/sqlite/queries/classificacao';

interface CatalogoItem { id: string; nome: string; }

export function useSubassuntos(assuntoId?: string) {
    const [data, setData] = useState<CatalogoItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!assuntoId) { if (!cancelled) setData([]); return; }
            if (!cancelled) setLoading(true);
            try {
                const c = await getContainerAsync();
                const rows = await c.sqlite.query<CatalogoItem>(CLASSIFICACAO_SUBASSUNTOS.sql, [assuntoId]);
                if (!cancelled) setData(rows);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [assuntoId]);

    return { data, loading };
}

export function useSubunidades(setorId?: string) {
    const [data, setData] = useState<CatalogoItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!setorId) { if (!cancelled) setData([]); return; }
            if (!cancelled) setLoading(true);
            try {
                const c = await getContainerAsync();
                const rows = await c.sqlite.query<CatalogoItem>(CLASSIFICACAO_SUBUNIDADES.sql, [setorId]);
                if (!cancelled) setData(rows);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [setorId]);

    return { data, loading };
}

export function useProgramasOrcamentarios() {
    const [data, setData] = useState<CatalogoItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!cancelled) setLoading(true);
            try {
                const c = await getContainerAsync();
                const rows = await c.sqlite.query<CatalogoItem>(CLASSIFICACAO_PROGRAMAS_ORCAMENTARIOS.sql, []);
                if (!cancelled) setData(rows);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    return { data, loading };
}

export function useModelosResposta(tipoId?: string, assuntoId?: string) {
    const [data, setData] = useState<ModeloResposta[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!cancelled) setLoading(true);
            try {
                const c = await getContainerAsync();
                const rows = await c.manifestacaoRepository.listModelosResposta(tipoId, assuntoId);
                if (!cancelled) setData(rows);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [tipoId, assuntoId]);

    return { data, loading };
}
