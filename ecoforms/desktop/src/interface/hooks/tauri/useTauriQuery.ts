import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useSqlite } from '../queries/useSqlite';

function isTauri() { return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window; }

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
  const sqlite = useSqlite();

  return useQuery<T[], Error>({
    queryKey: ['tauri-query', sql, JSON.stringify(params)],
    queryFn: async () => {
      if (!isTauri()) return [] as T[];
      try {
        return await sqlite.query<T>(sql, params);
      } catch (error) {
        throw new Error(`Query failed: ${error}`);
      }
    },
    ...options,
  });
}
