import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';

function isTauri() { return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window; }

type QueryParam = string | number | boolean | null | undefined;

interface ExecuteParams {
  sql: string;
  params?: QueryParam[];
}

/**
 * Hook para executar comandos SQL (INSERT, UPDATE, DELETE) via Tauri
 * @param options Opções do React Query
 */
export function useTauriMutation(
  options?: Omit<UseMutationOptions<number, Error, ExecuteParams>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<number, Error, ExecuteParams>({
    mutationFn: async ({ sql, params = [] }) => {
      if (!isTauri()) return 0;
      try {
        const affected = await invoke<number>('db_execute', { sql, params });
        return affected;
      } catch (error) {
        throw new Error(`Execute failed: ${error}`);
      }
    },
    onSuccess: () => {
      // Invalida todas as queries para forçar refresh
      queryClient.invalidateQueries({ queryKey: ['tauri-query'] });
    },
    ...options,
  });
}

/**
 * Hook para obter o último ID inserido
 */
export function useLastInsertId() {
  return useMutation<number, Error, void>({
    mutationFn: async () => {
      if (!isTauri()) return 0;
      return await invoke<number>('db_last_insert_id');
    },
  });
}

/**
 * Hook para executar múltiplos comandos SQL em transação
 */
export function useTauriBatch(
  options?: Omit<UseMutationOptions<void, Error, string[]>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string[]>({
    mutationFn: async (sqls) => {
      if (!isTauri()) return;
      try {
        await invoke<void>('db_execute_batch', { sqls });
      } catch (error) {
        throw new Error(`Batch execute failed: ${error}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tauri-query'] });
    },
    ...options,
  });
}
