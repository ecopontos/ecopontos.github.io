import { useMemo } from 'react';
import { useContainer } from '../utils/useContainer';

export function useUserUseCases() {
    const container = useContainer();
    return useMemo(() => container.users, [container]);
}
