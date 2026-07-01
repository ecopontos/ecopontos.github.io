import type { UseQueryOptions } from '@tanstack/react-query';
import { useTauriQuery } from '@/src/interface/hooks/catalog/tauri';
import { PACOTES_PENDING_SOLICITACOES_COUNT } from '@/src/application/persistence/sqlite/queries/pacotes';

type Options = Omit<UseQueryOptions<{ total: number }[], Error>, 'queryKey' | 'queryFn'>;

export function usePendingSolicitacoesCount(setorId: string | null, options?: Options) {
    return useTauriQuery<{ total: number }>(
        PACOTES_PENDING_SOLICITACOES_COUNT.sql,
        [setorId, setorId],
        options,
    );
}
