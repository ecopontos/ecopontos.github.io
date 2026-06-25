import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

function isTauri() { return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window; }

interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rows_affected: number;
}

type QueryParam = string | number | boolean | null | undefined;

/**
 * Hook para executar queries SELECT via Tauri
 * @param sql Query SQL a executar
 * @param params Parâmetros da query
 * @param options Opções do React Query
 */
export function useTauriQuery<T = Record<string, unknown>>(
  sql: string,
  params: QueryParam[] = [],
  options?: Omit<UseQueryOptions<T[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T[], Error>({
    queryKey: ['tauri-query', sql, JSON.stringify(params)],
    queryFn: async () => {
      if (!isTauri()) return [] as T[];
      try {
        const result = await invoke<QueryResult>('db_query', { sql, params });
        return result.rows.map((row) => {
          const obj: Record<string, unknown> = {};
          result.columns.forEach((col, idx) => { obj[col] = row[idx]; });
          return obj as T;
        });
      } catch (error) {
        throw new Error(`Query failed: ${error}`);
      }
    },
    ...options,
  });
}
