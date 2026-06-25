import { useMemo } from 'react';
import { getContainer } from '../../../infrastructure/container';

export function useDataRegistryUseCases() {
    return useMemo(() => getContainer().dataRegistry, []);
}
