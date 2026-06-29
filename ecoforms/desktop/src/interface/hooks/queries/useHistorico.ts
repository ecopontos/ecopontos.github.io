/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { getContainerAsync } from '@/src/infrastructure/container';
import type { ExecucaoHistorico } from '@/src/domain/logistics/LogisticsRepository';

export function useHistoricoByExecucao(execucaoId: string | null) {
  const [data, setData] = useState<ExecucaoHistorico[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!execucaoId) { setData([]); setLoading(false); return; }
    setLoading(true);
    try {
      const c = await getContainerAsync();
      const rows = await c.logisticsRepository.findHistoricoByExecucao(execucaoId);
      setData(rows);
    } finally {
      setLoading(false);
    }
  }, [execucaoId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
}
