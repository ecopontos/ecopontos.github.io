/* eslint-disable react-hooks/set-state-in-effect */
/**
 * Hooks de ponto operacional (Fase 4 — georreferenciamento).
 * Padrão espelha useClientes.ts / useLogistics.ts.
 */
import { useState, useEffect, useCallback } from 'react';
import type { PontoOperacional } from '@/types/clientes';
import {
  fetchPontosOperacionaisByImovel,
  insertPontoOperacional,
  updatePontoOperacional,
  deletePontoOperacional,
  setPontoOperacionalPrincipal,
} from './lookups/geo';

export function usePontosOperacionais(imovelId: string | null) {
  const [data, setData] = useState<PontoOperacional[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!imovelId) { setData([]); setLoading(false); return; }
    setLoading(true);
    try {
      const rows = await fetchPontosOperacionaisByImovel(imovelId);
      setData(rows.map(rowToPontoOperacional));
    } finally {
      setLoading(false);
    }
  }, [imovelId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
}

function rowToPontoOperacional(r: Record<string, unknown>): PontoOperacional {
  return {
    id: String(r.id),
    imovel_id: String(r.imovel_id),
    tipo: (r.tipo ?? null) as PontoOperacional['tipo'],
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    principal: Number(r.principal ?? 0),
    origem: (r.origem ?? null) as PontoOperacional['origem'],
    observacao: (r.observacao ?? null) as string | null,
    criado_em: (r.criado_em ?? null) as string | null,
    atualizado_em: (r.atualizado_em ?? null) as string | null,
  };
}

export function usePontoOperacionalMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withLoading = async <T,>(fn: () => Promise<T>): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const insert = useCallback(async (args: {
    id: string;
    imovel_id: string;
    tipo: string | null;
    latitude: number;
    longitude: number;
    principal: boolean;
    origem: string | null;
    observacao: string | null;
  }) => withLoading(() => insertPontoOperacional(args)), []);

  const update = useCallback(async (args: {
    id: string;
    tipo: string | null;
    latitude: number;
    longitude: number;
    observacao: string | null;
  }) => withLoading(() => updatePontoOperacional(args)), []);

  const remove = useCallback(async (id: string) => withLoading(() => deletePontoOperacional(id)), []);

  const setPrincipal = useCallback(async (id: string, imovelId: string) =>
    withLoading(() => setPontoOperacionalPrincipal(id, imovelId)), []);

  return { insert, update, remove, setPrincipal, loading, error };
}
