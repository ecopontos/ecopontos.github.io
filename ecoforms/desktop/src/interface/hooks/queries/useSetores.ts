/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { getContainerAsync } from '../utils/useContainer';
import { uuidv7 } from 'ecoforms-core';
import type { Setor } from '@/src/domain/setor/Setor';

export type { Setor };

export function useSetores(includeAll = false) {
  const [data, setData] = useState<Setor[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const c = await getContainerAsync();
      const rows = includeAll
        ? await c.setorRepository.findAll()
        : await c.setorRepository.findAtivos();
      setData(rows);
    } finally {
      setLoading(false);
    }
  }, [includeAll]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (nome: string, descricao?: string) => {
    const c = await getContainerAsync();
    await c.setorRepository.create(uuidv7(), nome, descricao);
    await fetch();
  }, [fetch]);

  const update = useCallback(async (id: string, nome: string, descricao?: string) => {
    const c = await getContainerAsync();
    await c.setorRepository.update(id, nome, descricao);
    await fetch();
  }, [fetch]);

  const remove = useCallback(async (id: string) => {
    const c = await getContainerAsync();
    await c.setorRepository.remove(id);
    await fetch();
  }, [fetch]);

  return { data, loading, refetch: fetch, create, update, remove };
}
