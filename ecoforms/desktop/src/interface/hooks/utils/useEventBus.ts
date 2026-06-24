import { useMemo } from 'react';
import { getContainer } from '@/src/infrastructure/container';
import type { SyncOutbox } from '@/src/infrastructure/sync/SyncOutbox';

export function useSyncOutbox(): SyncOutbox {
    return useMemo(() => getContainer().syncOutbox, []);
}

/** @deprecated Use useSyncOutbox */
export const useEventBus = useSyncOutbox;
