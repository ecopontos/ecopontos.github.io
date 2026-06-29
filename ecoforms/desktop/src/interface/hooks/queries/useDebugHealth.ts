/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { getContainerAsync } from '@/src/infrastructure/container';
import { SQLITE_DATABASE_LIST } from '@/src/infrastructure/persistence/sqlite/queries/system';

interface TableHealth {
  name: string;
  count: number;
  ok: boolean;
}

export function useDebugHealth() {
  const [tables, setTables] = useState<TableHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbPath, setDbPath] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const c = await getContainerAsync();
      const path = await c.sqlite.query<{ path: string }>(SQLITE_DATABASE_LIST.sql, []);
      setDbPath(path[0]?.path || "in-memory");

      const tableNames = [
        "clientes", "cliente_contatos",
        "manifestacoes", "tramitacoes", "respostas", "despachos", "anexos", "prazos", "notificacoes", "historico_alteracoes",
        "roteiros", "roteiro_clientes", "execucao_coleta", "checklist_execucao",
        "tipos_manifestacao", "origens", "classificacoes", "situacoes",
        "usuarios", "setores"
      ];

      const results: TableHealth[] = [];
      for (const name of tableNames) {
        try {
          const rows = await c.sqlite.query<{ count: number }>(`SELECT COUNT(*) as count FROM ${name}`, []);
          results.push({ name, count: rows[0]?.count ?? 0, ok: true });
        } catch {
          results.push({ name, count: -1, ok: false });
        }
      }
      setTables(results);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { tables, loading, dbPath, refetch: fetch };
}
