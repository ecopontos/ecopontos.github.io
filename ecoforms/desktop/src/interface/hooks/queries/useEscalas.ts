/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { uuidv7 } from 'ecoforms-core';
import {
  fetchEscalasFull,
  insertEscala,
  updateEscala,
  deleteEscala,
} from '@/src/interface/hooks/queries/lookups/admin';

export interface Escala {
  id: string;
  nome: string;
  tipo: string;
  referencia_inicio: string;
  duracao_minutos: number;
  tolerancia_minutos: number;
  ciclo_horas: number;
  criado_em: string;
  atualizado_em: string;
}

export function useEscalas() {
  const [data, setData] = useState<Escala[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchEscalasFull();
      setData((rows as unknown as Escala[]) || []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const create = useCallback(async (input: Omit<Escala, 'id' | 'criado_em' | 'atualizado_em'>) => {
    const now = new Date().toISOString();
    await insertEscala({
      id: uuidv7(),
      nome: input.nome,
      tipo: input.tipo,
      referencia_inicio: input.referencia_inicio,
      duracao_minutos: input.duracao_minutos,
      tolerancia_minutos: input.tolerancia_minutos,
      ciclo_horas: input.ciclo_horas,
      criado_em: now,
      atualizado_em: now,
    });
    await refetch();
  }, [refetch]);

  const update = useCallback(async (id: string, input: Omit<Escala, 'id' | 'criado_em' | 'atualizado_em'>) => {
    const now = new Date().toISOString();
    await updateEscala({
      id,
      nome: input.nome,
      tipo: input.tipo,
      referencia_inicio: input.referencia_inicio,
      duracao_minutos: input.duracao_minutos,
      tolerancia_minutos: input.tolerancia_minutos,
      ciclo_horas: input.ciclo_horas,
      atualizado_em: now,
    });
    await refetch();
  }, [refetch]);

  const remove = useCallback(async (id: string) => {
    await deleteEscala(id);
    await refetch();
  }, [refetch]);

  return { data, loading, refetch, create, update, remove };
}
