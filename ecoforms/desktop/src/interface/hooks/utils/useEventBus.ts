import { useMemo } from 'react';
import { useContainer } from './useContainer';

export function useSyncOutbox() {
    const container = useContainer();
    return useMemo(() => container.syncOutbox, [container]);
}

/** @deprecated Use useSyncOutbox */
export const useEventBus = useSyncOutbox;
