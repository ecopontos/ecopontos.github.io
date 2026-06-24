import { useMemo, useState } from 'react';
import { getContainer } from '../../../infrastructure/container';

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Hook para acessar o serviço de sincronização com gerenciamento de estado (loading, erro).
 */
export function useSync() {
    const syncService = useMemo(() => getContainer().sync, []);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const syncAll = async () => {
        setSyncing(true);
        setError(null);
        try {
            const result = await syncService.syncAll();
            if (!result.success) {
                setError(result.errors?.join(", ") || "Erro desconhecido na sincronização");
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
