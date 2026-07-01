import { useMemo, useState } from 'react';
import { useContainer } from '../utils/useContainer';

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Hook para acessar o serviço de sincronização com gerenciamento de estado (loading, erro).
 */
export function useSync() {
    const container = useContainer();
    const syncService = useMemo(() => container.sync, [container]);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const syncAll = async () => {
        setSyncing(true);
        setError(null);
        try {
            const result = await syncService.syncAll();
            if (!result.success) {
                setError(result.errors?.join(', ') || 'Erro desconhecido na sincronização');
            }
            return result;
        } catch (err: unknown) {
            setError(getErrorMessage(err));
            throw err;
        } finally {
            setSyncing(false);
        }
    };

    return { syncAll, syncing, error };
}
