import { useMemo } from 'react';
import { useContainer } from '../utils/useContainer';

export function useDataRegistryUseCases() {
    const container = useContainer();
    return useMemo(() => container.dataRegistry, [container]);
}
