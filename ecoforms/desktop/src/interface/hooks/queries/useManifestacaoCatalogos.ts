/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { getContainerAsync } from '../utils/useContainer';
import {
  MANIFESTACOES_CATALOGOS_TIPOS,
  MANIFESTACOES_CATALOGOS_ORIGENS,
  MANIFESTACOES_CATALOGOS_CLASSIFICACOES,
  MANIFESTACOES_CATALOGOS_SITUACOES,
} from '@/src/infrastructure/persistence/sqlite/queries/manifestacoes';

interface CatalogoItem {
  id: string;
  nome: string;
}

export function useManifestacaoCatalogos() {
  const [tipos, setTipos] = useState<CatalogoItem[]>([]);
  const [origens, setOrigens] = useState<CatalogoItem[]>([]);
  const [classificacoes, setClassificacoes] = useState<CatalogoItem[]>([]);
  const [situacoes, setSituacoes] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const c = await getContainerAsync();
      const [t, o, cl, s] = await Promise.all([
        c.sqlite.query<CatalogoItem>(MANIFESTACOES_CATALOGOS_TIPOS.sql, []),
        c.sqlite.query<CatalogoItem>(MANIFESTACOES_CATALOGOS_ORIGENS.sql, []),
        c.sqlite.query<CatalogoItem>(MANIFESTACOES_CATALOGOS_CLASSIFICACOES.sql, []),
        c.sqlite.query<CatalogoItem>(MANIFESTACOES_CATALOGOS_SITUACOES.sql, []),
      ]);
      setTipos(t);
      setOrigens(o);
      setClassificacoes(cl);
      setSituacoes(s);
    } finally {
      setLoading(false);
    }
  }, []);

  const seedTipos = useCallback(async () => {
    const c = await getContainerAsync();
    await c.seedManifestacaoCatalog.execute();
    await fetch();
  }, [fetch]);

  useEffect(() => { fetch(); }, [fetch]);

  return { tipos, origens, classificacoes, situacoes, loading, seedTipos };
}
