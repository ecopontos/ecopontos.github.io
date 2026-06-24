import { useMemo } from 'react';
import { getContainer } from '../../../infrastructure/container';

export function useUserUseCases() {
    return useMemo(() => getContainer().users, []);
}
